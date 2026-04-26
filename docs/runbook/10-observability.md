# 10 - Observability

**Parent:** [Runbook Index](./00-index.md)

---

## 10.1 Observability Stack

FlowForge runs a full observability stack in the `monitoring` namespace, managed by Argo CD via the `flowforge-infra` Application.

| Component | Purpose |
|:---|:---|
| Prometheus | Time-series metrics collection and storage |
| Grafana | Metrics visualization and dashboards |
| Alertmanager | Alert routing — sends notifications to email and Slack |
| Argo Rollouts Dashboard | Real-time rollout progress and traffic weight visibility |

---

## 10.2 Liveness and Readiness Probes

Every microservice Rollout defines both a liveness probe and a readiness probe. These are the foundation of Kubernetes self-healing behavior.

**Example from auth-service Rollout:**

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8001
  initialDelaySeconds: 15
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 8001
  initialDelaySeconds: 5
  periodSeconds: 10
```

**Readiness Probe:**

The readiness probe tells Kubernetes whether a pod is ready to receive traffic. During startup, a FastAPI service may take several seconds to import its modules, connect to PostgreSQL, and complete initialization. The readiness probe waits `initialDelaySeconds: 5` before the first check, then probes every 10 seconds. Until the `/health` endpoint returns HTTP 200, the pod is not added to the Service's endpoint list. No traffic is sent to a pod that has not passed its readiness probe.

During a Canary deployment, if the new pod fails its readiness probe, it never receives any traffic. The Rollout stays in a paused state with 0% traffic on the canary, protecting users from being served by a broken pod.

**Liveness Probe:**

The liveness probe tells Kubernetes whether a running pod has entered a broken state (deadlock, memory corruption, hung process). If the `/health` endpoint fails to respond for a sufficient number of consecutive periods, Kubernetes kills the container and restarts it automatically. This is the self-healing mechanism.

`initialDelaySeconds: 15` is longer for the liveness probe than the readiness probe. This prevents Kubernetes from killing a pod that is still in a normal startup phase.

**Self-healing scenario:**

1. An auth-service pod enters a deadlock state. Its goroutines are all blocked.
2. The FastAPI event loop stops processing requests.
3. The liveness probe HTTP request to `/health` times out for three consecutive checks (default failure threshold).
4. Kubernetes marks the container as unhealthy and restarts it.
5. The new container starts fresh, passes the readiness probe, and rejoins the Service endpoints.
6. The entire recovery is automatic, with no human intervention.

The frontend pods do not define probes (they serve a static Next.js bundle) but the gateway and all backend services have probes configured.

---

## 10.3 Alertmanager Configuration

Alertmanager is configured with rules defined in `infra/infrastructure/monitoring-rules.yaml`. When Prometheus evaluates an alert rule as firing, it sends the alert to Alertmanager, which routes it based on configured receivers.

Alertmanager is accessible at `prometheus.flowforge.fun` (requires HTTP basic authentication as defined in HAProxy).

---

## 10.4 Accessing Observability Dashboards

| Dashboard | URL | Authentication |
|:---|:---|:---|
| Grafana | `grafana.flowforge.fun` | Grafana internal login |
| Prometheus | `prometheus.flowforge.fun` | HAProxy basic auth |
| Argo Rollouts | `rollouts.flowforge.fun` | HAProxy basic auth |
| Argo CD | `argocd.flowforge.fun` | Argo CD internal login |
| Headlamp (K8s UI) | `headlamp.flowforge.fun` | Headlamp token |

---

## 10.5 HPA Metrics

The HorizontalPodAutoscaler in each service requires the Kubernetes Metrics Server to be running. The Metrics Server scrapes resource usage from the kubelet on each node and exposes it via the `metrics.k8s.io` API. The HPA controller reads CPU utilization from this API every 15 seconds and adjusts the replica count accordingly.

To verify the Metrics Server is providing data:

```bash
kubectl top pods -n dev
kubectl top pods -n prod
```

If this command fails, the HPA will not scale and will log a `FailedGetResourceMetric` event in the HPA object.
