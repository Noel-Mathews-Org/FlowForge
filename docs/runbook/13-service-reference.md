# 13 - Service and Domain Reference

**Parent:** [Runbook Index](./00-index.md)

---

## 13.1 Microservice Port Reference

The following table lists every microservice in the FlowForge platform, its container port, the Kubernetes Service port, the GHCR image path, and its role.

| Service | Container Port | K8s Service Port | Image Repository | Role |
|:---|:---|:---|:---|:---|
| gateway | 8000 | 80 | `ghcr.io/noel-mathews-org/flowforge/gateway` | API Gateway — JWT validation, rate limiting, routing |
| auth-service | 8001 | 80 | `ghcr.io/noel-mathews-org/flowforge/auth-service` | User registration, login, token refresh, invitations |
| project-service | 8002 | 80 | `ghcr.io/noel-mathews-org/flowforge/project-service` | Project and workspace management, email notifications |
| task-service | 8003 | 80 | `ghcr.io/noel-mathews-org/flowforge/task-service` | Kanban task management, assignments, status tracking |
| analysis-service | 8004 | 80 | `ghcr.io/noel-mathews-org/flowforge/analysis-service` | Analytics, productivity metrics, event consumption |
| frontend | 3000 | 80 | `ghcr.io/noel-mathews-org/flowforge/frontend` | Next.js 14 web application |

---

## 13.2 Infrastructure Service Ports

| Service | Port | Protocol | Location |
|:---|:---|:---|:---|
| HAProxy HTTPS | 443 | TCP | EC2 `10.0.1.27` |
| HAProxy HTTP (redirect) | 80 | TCP | EC2 `10.0.1.27` |
| SonarQube | 9000 | HTTP | EC2 `10.0.1.248` |
| NFS Server | 2049 | NFS | EC2 `10.0.1.140` |
| kgateway (Dev/Prod App) NodePort | 31323 (dev), 30605 (prod) | TCP | All worker nodes |
| kgateway (Dashboard) NodePort | 30639 | TCP | All worker nodes |
| PostgreSQL | 5432 | TCP | ClusterIP only |
| Redis | 6379 | TCP | ClusterIP only |

---

## 13.3 Internal Service DNS Names

Kubernetes DNS allows services to be addressed using their fully-qualified domain name. The pattern is:

`<service-name>.<namespace>.svc.cluster.local`

| Service | Dev DNS Name | Prod DNS Name |
|:---|:---|:---|
| API Gateway | `gateway.dev.svc.cluster.local` | `gateway.prod.svc.cluster.local` |
| Auth Service | `auth-service.dev.svc.cluster.local` | `auth-service.prod.svc.cluster.local` |
| Project Service | `project-service.dev.svc.cluster.local` | `project-service.prod.svc.cluster.local` |
| Task Service | `task-service.dev.svc.cluster.local` | `task-service.prod.svc.cluster.local` |
| Analysis Service | `analysis-service.dev.svc.cluster.local` | `analysis-service.prod.svc.cluster.local` |
| PostgreSQL | `postgres.dev.svc.cluster.local` | `postgres.prod.svc.cluster.local` |
| Redis | `redis.dev.svc.cluster.local` | `redis.prod.svc.cluster.local` |

---

## 13.4 Domain and Subdomain Reference

All domains are hosted under the root domain `flowforge.fun`. DNS A records point to the public IP of the HAProxy EC2 instance.

**Application URLs:**

| Subdomain | Environment | Routes To | Description |
|:---|:---|:---|:---|
| `flowforge.fun` | Production | `flowforge_prod` backend (NodePort 30605) | Live production application |
| `preview.flowforge.fun` | Production | `flowforge_prod` backend (NodePort 30605) | Blue-Green preview URL for new frontend versions |
| `dev.flowforge.fun` | Development | `flowforge_dev` backend (NodePort 31323) | Development environment |

**Infrastructure / Dashboard URLs:**

| Subdomain | Routes To | Authentication | Description |
|:---|:---|:---|:---|
| `sonar.flowforge.fun` | SonarQube EC2 (port 9000) | SonarQube login | Code quality dashboard |
| `argocd.flowforge.fun` | kgateway dashboard-gateway | Argo CD login | GitOps deployment dashboard |
| `grafana.flowforge.fun` | kgateway dashboard-gateway | Grafana login | Metrics and monitoring dashboards |
| `prometheus.flowforge.fun` | kgateway dashboard-gateway | HAProxy basic auth | Raw Prometheus metrics and alert rules |
| `rollouts.flowforge.fun` | kgateway dashboard-gateway | HAProxy basic auth | Argo Rollouts live traffic dashboard |
| `headlamp.flowforge.fun` | kgateway dashboard-gateway | Headlamp token | Kubernetes cluster UI |
| `keycloak.flowforge.fun` | kgateway dashboard-gateway | Keycloak login | Identity provider admin console |

**HAProxy Basic Auth Credentials (for protected dashboards):**

Two user accounts exist in the `monitoring_users` userlist. Credentials are managed directly in `/etc/haproxy/haproxy.cfg` on the HAProxy EC2 instance.

---

## 13.5 HPA Scaling Configuration Reference

| Service | Min Replicas | Max Replicas | CPU Target |
|:---|:---|:---|:---|
| gateway | 2 | 4 | 70% |
| auth-service | 2 | 4 | 70% |
| project-service | 2 | 4 | 70% |
| task-service | 2 | 4 | 70% |
| analysis-service | 2 | 4 | 70% |
| frontend | 2 | 4 | 70% |

---

## 13.6 Resource Requests Reference

All services define resource requests. Limits are intentionally not set to avoid OOMKilled events during legitimate traffic spikes, while requests ensure the scheduler places pods on nodes with sufficient capacity.

| Service | CPU Request | Memory Request |
|:---|:---|:---|
| gateway | 100m | 128Mi |
| auth-service | 100m | 96Mi |
| project-service | 100m | 96Mi |
| task-service | 100m | 96Mi |
| analysis-service | 100m | 96Mi |
| frontend | 100m | 128Mi |

---

## 13.7 Rollout Names Reference

The Rollout resource name follows the pattern `<helm-release-name>-<chart-name>`.

| Service | Dev Rollout Name | Prod Rollout Name |
|:---|:---|:---|
| Gateway | `flowforge-dev-gateway` | `flowforge-prod-gateway` |
| Frontend | `flowforge-dev-frontend` | `flowforge-prod-frontend` |
| Auth Service | `flowforge-dev-auth-service` | `flowforge-prod-auth-service` |
| Project Service | `flowforge-dev-project-service` | `flowforge-prod-project-service` |
| Task Service | `flowforge-dev-task-service` | `flowforge-prod-task-service` |
| Analysis Service | `flowforge-dev-analysis-service` | `flowforge-prod-analysis-service` |

Use these names with the Argo Rollouts CLI:

```bash
kubectl argo rollouts get rollout <rollout-name> -n <namespace>
kubectl argo rollouts promote <rollout-name> -n <namespace>
kubectl argo rollouts abort <rollout-name> -n <namespace>
kubectl argo rollouts restart <rollout-name> -n <namespace>
```
