# 05 - Deployment Strategies

**Parent:** [Runbook Index](./00-index.md)

---

## 5.1 Why Deployment Strategies Matter

Standard Kubernetes Deployments perform a rolling update that replaces old pods with new ones. During this transition, both old and new code runs simultaneously in an uncontrolled way. If the new version has a bug, traffic is already being split between stable and broken pods with no control mechanism.

FlowForge uses **Argo Rollouts** to implement controlled, observable deployment strategies for every service. Argo Rollouts replaces the standard `Deployment` kind with a `Rollout` kind that adds structured traffic control, pause points, and promotion gates.

---

## 5.2 Frontend: Blue-Green Deployment

**Why Blue-Green for the Frontend?**

The frontend is a user-facing Next.js application. A broken UI change has immediate and visible impact on every user. Blue-Green was chosen because it provides a completely isolated preview environment that can be verified by a human before any production traffic touches the new version. The old version (Blue) remains fully live and fully healthy while the new version (Green) is deployed and tested.

**How it works in FlowForge:**

Argo Rollouts manages two Kubernetes Services for the frontend:
- `flowforge-dev-frontend-active` — receives all live traffic
- `flowforge-dev-frontend-preview` — receives zero live traffic; used for preview

When a new frontend image is deployed:

1. Argo Rollouts creates a new pod (Green) with the new image and connects it to the `preview` service.
2. The `active` service continues routing all traffic to the old pod (Blue) without interruption.
3. The engineer accesses `preview.flowforge.fun` in their browser. HAProxy routes this subdomain to the preview service via the `flowforge-preview-routes` HTTPRoute, serving the Green pod exclusively.
4. The engineer verifies the change looks correct.
5. The engineer manually promotes:
   ```bash
   kubectl argo rollouts promote flowforge-dev-frontend -n dev
   ```
6. Argo Rollouts switches the `active` service selector to point to the Green pod.
7. The old Blue pod is scaled down after `scaleDownDelaySeconds: 30`.

**Manifest reference (`Helm/charts/frontend/templates/rollout.yaml`):**

```yaml
strategy:
  blueGreen:
    activeService: flowforge-dev-frontend-active
    previewService: flowforge-dev-frontend-preview
    autoPromotionEnabled: false
    previewReplicaCount: 1
    scaleDownDelaySeconds: 30
```

`autoPromotionEnabled: false` is the critical setting. Without it, Argo Rollouts would promote automatically after the preview pod becomes healthy, eliminating the human verification gate.

---

## 5.3 Backend Microservices: Canary Deployment

**Why Canary for Microservices?**

Backend microservices handle API logic, database writes, and event publishing. A broken microservice can corrupt data, cause cascading failures, or return errors for a percentage of user requests. Canary deployment limits the blast radius of a bad release. If the new version fails, only 50% of requests are affected, and an immediate abort restores 100% traffic to the stable version.

**How it works in FlowForge:**

All five backend services (auth, project, task, analysis, gateway) use a Canary Rollout with a single step: set traffic weight to 50% and pause indefinitely for human approval.

```yaml
strategy:
  canary:
    steps:
    - setWeight: 50
    - pause: {}
```

When a new image is deployed:

1. Argo Rollouts creates one new pod (the canary) with the new image.
2. The canary pod receives 50% of incoming traffic via Kubernetes Service load balancing across the two pods (1 stable + 1 canary).
3. The Rollout enters a `Paused` state.
4. The engineer monitors the Rollout dashboard, checks logs, and reviews Grafana dashboards for error rate, latency, and throughput.
5. The engineer manually promotes:
   ```bash
   kubectl argo rollouts promote flowforge-dev-auth-service -n dev
   ```
6. Argo Rollouts scales up the new version to full replica count and scales down the old stable pods.

**Pod Anti-Affinity ensures physical separation:**

Every Rollout manifest includes a `requiredDuringSchedulingIgnoredDuringExecution` anti-affinity rule with `topologyKey: kubernetes.io/hostname`. This forces Kubernetes to place the stable pod on Worker Node 1 and the canary pod on Worker Node 2. The two versions are physically isolated and cannot interfere with each other at the infrastructure level.

```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
    - labelSelector:
        matchExpressions:
        - key: app
          operator: In
          values:
          - flowforge-dev-auth-service
      topologyKey: "kubernetes.io/hostname"
```

---

## 5.4 HorizontalPodAutoscaler

Every service (frontend, gateway, and all microservices) has an HPA attached to its Rollout. The HPA is configured to target the Argo Rollout kind directly, not a standard Deployment.

```yaml
scaleTargetRef:
  apiVersion: argoproj.io/v1alpha1
  kind: Rollout
  name: flowforge-dev-auth-service
minReplicas: 2
maxReplicas: 4
targetCPUUtilizationPercentage: 70
```

**Scale-up behavior:** Immediate response. The HPA can add up to 4 pods per 15-second window (`selectPolicy: Max`) to handle sudden traffic spikes.

**Scale-down behavior:** Conservative. A 300-second stabilization window prevents premature scale-down after a traffic spike subsides.

The minimum replica count of 2 ensures that even in a quiet period, there is always one pod on each worker node, maintaining the anti-affinity guarantee and high availability.
