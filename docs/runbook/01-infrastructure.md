# 01 - Infrastructure Overview

**Parent:** [Runbook Index](./00-index.md)

---

## 1.1 Cloud Platform

FlowForge runs entirely on **Amazon Web Services (AWS)**. All compute resources are EC2 instances provisioned within a single VPC on the `10.0.0.0/16` CIDR block.

---

## 1.2 EC2 Node Inventory

| Role | Private IP | Purpose |
|:---|:---|:---|
| HAProxy Load Balancer | 10.0.1.27 | Edge proxy, SSL termination, subdomain routing |
| Kubernetes Master Node | 10.0.1.155 | Kubernetes control plane |
| Kubernetes Worker Node 1 | 10.0.1.102 | Application workload hosting |
| Kubernetes Worker Node 2 | 10.0.1.245 | Application workload hosting |
| SonarQube Server | 10.0.1.248 | Self-hosted SonarQube on port 9000 |
| NFS Storage Server | 10.0.1.140 | Persistent volume backend, exports `/var/nfs/paycrest` |

---

## 1.3 Kubernetes Cluster Topology

The cluster is a self-managed Kubernetes cluster with one master node and two worker nodes.

```
Master Node (10.0.1.155)
  - kube-apiserver
  - etcd
  - kube-controller-manager
  - kube-scheduler
  - Argo CD controller
  - Argo Rollouts controller

Worker Node 1 (10.0.1.102)
  - Application pods (distributed via anti-affinity)
  - kgateway Envoy proxy pods

Worker Node 2 (10.0.1.245)
  - Application pods (distributed via anti-affinity)
  - kgateway Envoy proxy pods
```

Pod anti-affinity rules are defined in every Rollout manifest using `requiredDuringSchedulingIgnoredDuringExecution` with `topologyKey: kubernetes.io/hostname`. This forces Kubernetes to schedule each service's replicas on different physical nodes. If Worker Node 1 goes down, a complete set of pods remains healthy on Worker Node 2.

---

## 1.4 Kubernetes Namespace Layout

| Namespace | Purpose |
|:---|:---|
| `dev` | Development environment, synced from the `test` branch |
| `prod` | Production environment, synced from the `prod` branch |
| `argocd` | Argo CD server and application controller |
| `argo-rollouts` | Argo Rollouts controller and dashboard |
| `gateway` | Central kgateway (Envoy) instance for dashboard routing |
| `monitoring` | Prometheus, Grafana, Alertmanager |
| `logging` | Log aggregation stack |
| `keycloak` | Keycloak Identity Provider and its dedicated PostgreSQL |
| `kgateway-system` | kgateway CRD controllers and operators |

The `dev` and `prod` namespaces are completely isolated. They have separate database instances, separate secrets, separate network policies, and separate gateway instances. Traffic cannot cross between them at the network layer.

---

## 1.5 Argo CD Application Definitions

Argo CD manages three top-level Application resources:

**flowforge-dev** (`infra/argocd/dev-app.yaml`)
- Source: `test` branch, path `Helm/`, values file `values-dev.yaml`
- Destination namespace: `dev`
- Sync: Automated with `prune: true` and `selfHeal: true`

**flowforge-prod** (prod branch equivalent)
- Source: `prod` branch, path `Helm/`, values file `values-prod.yaml`
- Destination namespace: `prod`
- Sync: Automated

**flowforge-infra** (`infra/argocd/infra-app.yaml`)
- Source: `test` branch, path `infra/infrastructure/`
- Destination namespace: `gateway`
- Deploys: dashboard-gateway, dashboard HTTPRoutes, ReferenceGrants, alertmanager config, monitoring rules, Rollouts dashboard
