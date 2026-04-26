# Presentation Content — Part 2: Architecture Slides and Service Reference

---

## SLIDE 5 — Application Architecture

*(Attach the application architecture diagram image here)*

### Overview

FlowForge is a microservices application. The frontend is a Next.js 14 React application. All API traffic passes through a central FastAPI Gateway before being routed to one of four backend Python microservices. All services share a single PostgreSQL 16 instance with four logical databases. Redis provides rate limiting for the Gateway and an event bus for asynchronous communication between services.

### Architecture Explanation

```
Internet
    |
[ HAProxy — SSL Termination ]
    |
[ API Gateway — FastAPI ] <---> [ Redis — Rate Limiting ]
    |
    +--------+-----------+-----------+
    |        |           |           |
[ Auth ] [ Project ] [ Task ] [ Analysis ]
    |        |           |           |
    +--------+-----------+-----------+
             |                   |
       [ PostgreSQL ]      [ Redis — Event Bus ]
```

**Key design decisions:**

- The Gateway is the single entry point for all API traffic. It validates JWT tokens, enforces rate limits, and routes requests. This centralizes authentication and reduces complexity in each microservice.
- The frontend communicates only with the Gateway via `/api`. It never calls a microservice directly.
- Redis serves two roles: a rate-limit counter store for the Gateway, and a message stream (Redis Streams / Pub-Sub) for microservices to publish and consume events asynchronously.
- PostgreSQL uses four logical databases (auth_db, project_db, task_db, analytics_db), one per service. Each service owns its schema exclusively and cannot read another service's tables.

---

## SLIDE 6 — Database Architecture

*(Attach the database architecture diagram image here)*

### Single PostgreSQL Instance, Four Logical Databases

| Database | Owner Service | Key Tables |
|:---|:---|:---|
| `auth_db` | auth-service | users, refresh_tokens, invite_tokens |
| `project_db` | project-service | projects, memberships |
| `task_db` | task-service | tasks, comments, attachments |
| `analytics_db` | analysis-service | events, productivity_metrics |

**Why one PostgreSQL instance?**

For a two-node cluster with limited resources, running four separate PostgreSQL containers would waste memory and CPU. A single instance with logical database separation provides the same data isolation guarantees with far lower overhead. Each service connects to only its own database using a connection string that includes the database name.

**Initialization:**

The `postgres-initdb` ConfigMap mounts an SQL script at `/docker-entrypoint-initdb.d/initdb.sql`. PostgreSQL automatically executes this script on first startup. The script creates all four databases and sets up schemas and initial seed data.

---

## SLIDE 7 — DevOps Architecture

*(Attach the DevOps architecture diagram image here)*

**Summary of the full pipeline:**

Developer pushes code to the `test` branch → GitHub Actions triggers the service-specific CI workflow → SonarQube SAST scan → Snyk SCA scan → Docker image build → Trivy image scan → Push to GHCR with commit SHA tag → Pipeline writes the new SHA to `values-dev.yaml` and commits to `test` branch → Argo CD detects the diff → Argo CD syncs the dev namespace → Argo Rollouts starts a Canary/Blue-Green deployment → Engineer manually promotes → Application is live.

For production: Engineer creates a GitHub Release → Production pipeline reads the dev SHA from `values-dev.yaml` → Pulls image and re-runs Trivy → Retags with semver → Pushes to GHCR → Updates `values-prod.yaml` on the `prod` branch → Argo CD syncs the prod namespace → Argo Rollouts pauses at 50% Canary → Engineer manually promotes.

---

## SLIDE 8 — Microservices and Container Ports

| Service | Language / Framework | Container Port | K8s Service Port | Purpose |
|:---|:---|:---|:---|:---|
| gateway | Python / FastAPI | 8000 | 80 | API gateway, JWT auth, rate limiting, request routing |
| auth-service | Python / FastAPI | 8001 | 80 | User management, login, token refresh, team invitations |
| project-service | Python / FastAPI | 8002 | 80 | Project and workspace lifecycle, email notifications |
| task-service | Python / FastAPI | 8003 | 80 | Kanban task management, assignments, comments |
| analysis-service | Python / FastAPI | 8004 | 80 | Analytics, productivity metrics, event stream consumption |
| frontend | Next.js 14 / Node | 3000 | 80 | Web UI served to end users |
| postgres | PostgreSQL 16 | 5432 | 5432 | Relational database — all services |
| redis | Redis 7 | 6379 | 6379 | Rate limiting and async event bus |

**Why all K8s Service ports are 80:**

Inside the cluster, every service-to-service call uses the Kubernetes Service name on port 80. This is consistent and requires no port knowledge by the caller. The port translation to the container port (e.g., 8001) is handled by the Service spec's `targetPort`. The Gateway uses environment variables from the ConfigMap (`AUTH_SERVICE_URL: http://auth-service:80`) to call services without hardcoded ports.

---

## SLIDE 9 — Domains, Subdomains, and Routing

All DNS records point to the public IP of the HAProxy EC2 instance at `10.0.1.27`.

### Application URLs

| Domain | Environment | NodePort | Final Destination |
|:---|:---|:---|:---|
| `flowforge.fun` | Production | 30605 | Active frontend pods + Gateway in `prod` namespace |
| `preview.flowforge.fun` | Production Preview | 30605 | Preview frontend pod (Blue-Green new version) |
| `dev.flowforge.fun` | Development | 31323 | Active frontend pods + Gateway in `dev` namespace |

### Infrastructure and Dashboard URLs

| Domain | Protected? | Routes To |
|:---|:---|:---|
| `sonar.flowforge.fun` | Sonar login | SonarQube EC2 on port 9000 |
| `argocd.flowforge.fun` | Argo CD login | argocd-server Service via dashboard-gateway |
| `grafana.flowforge.fun` | Grafana login | Grafana pod in monitoring namespace |
| `prometheus.flowforge.fun` | HAProxy basic auth | Prometheus pod in monitoring namespace |
| `rollouts.flowforge.fun` | HAProxy basic auth | Argo Rollouts dashboard pod |
| `headlamp.flowforge.fun` | Headlamp token | Headlamp pod for Kubernetes UI |
| `keycloak.flowforge.fun` | Keycloak login | Keycloak Identity Provider |

### How Routing Works (Two Layers)

**Layer 1 — HAProxy (EC2):** Terminates TLS at the edge. Reads the `Host` header of every incoming request and routes to the correct Kubernetes NodePort. Applies basic authentication for protected dashboards.

**Layer 2 — kgateway (Inside K8s):** Receives traffic from NodePorts. Uses the Kubernetes Gateway API (`Gateway` and `HTTPRoute` resources) to route based on hostname and URL path. The `flowforge-routes` HTTPRoute sends `/api` traffic to the Gateway service and `/` traffic to the `frontend-active` service. The `flowforge-preview-routes` HTTPRoute sends all traffic from `preview.flowforge.fun` to the `frontend-preview` service, enabling Blue-Green preview without impacting production traffic.
