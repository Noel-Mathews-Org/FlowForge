# FlowForge — Microsoft-Native Self-Hosted Project Management Suite

![FlowForge App Architecture](App%20Architecture.png)

FlowForge is a self-hosted, microservices-based project management platform engineered for organizations that operate within the **Microsoft corporate ecosystem**. It provides a clean, focused Kanban-style workspace while keeping all project data, AI-generated reports, and team metadata entirely within your own Azure tenant.

---

## 1. Why FlowForge?

Traditional project management tools impose complex pricing models, steep learning curves, and significant data privacy concerns. FlowForge solves this by running inside your own Azure environment and integrating natively with the services you already use:

| Integration | What It Provides |
| :--- | :--- |
| **Microsoft Entra ID (Azure AD)** | Corporate SSO — users log in with existing Microsoft credentials. Roles are auto-assigned from Entra ID Security Groups. |
| **Azure PostgreSQL Flexible Server** | Private, encrypted database with Managed Identity auth — no connection passwords stored anywhere. |
| **Azure Cache for Redis** | High-speed session rate-limiting and async event streaming between services. |
| **Azure AI Foundry (OpenAI)** | Automatically generates project progress summaries and organizational AI digests using the `summary-agent` model deployment. |
| **Azure Blob Storage** | Stores generated reports in a private `flowforge-reports` container using passwordless Managed Identity. |
| **Azure Key Vault** | Central, private secret store. All credentials are fetched at runtime — no `.env` files in production. |

---

## 2. Microservices Overview

FlowForge is composed of 7 decoupled services:

| Service | Port | Framework | Role |
| :--- | :--- | :--- | :--- |
| **`gateway`** | `8000` | FastAPI | BFF proxy — JWT validation, rate limiting (Redis), CORS, header injection, routing. |
| **`auth-service`** | `8001` | FastAPI + SQLAlchemy | User management, Entra ID SSO, invitations, in-app notifications, refresh tokens. |
| **`project-service`** | `8002` | FastAPI + SQLAlchemy | Project CRUD, member management, soft-archiving. |
| **`task-service`** | `8003` | FastAPI + SQLAlchemy | Kanban boards, task lifecycle, comments, manager approval gates. |
| **`analysis-service`** | `8004` | FastAPI + SQLAlchemy | AI summaries (Azure AI Foundry), analytics aggregation, report generation to Azure Blob. |
| **`notification-worker`** | N/A | Python asyncio | Redis stream consumer — sends SMTP emails for all platform events. |
| **`frontend`** | `3000` | Next.js 14 | React App Router UI — Entra SSO params baked in at Docker build time. |

---

## 3. 4-Tier Role-Based Access Control

```
platform_admin  →  org_owner  →  manager  →  member
```

| Role | Key Capabilities |
| :--- | :--- |
| `platform_admin` | Full system access, audit logs, user deactivation, manual analytics trigger. |
| `org_owner` | Org-wide visibility, invite managers, generate AI reports, transfer members. |
| `manager` | Create projects, manage Kanban boards, invite members, approve/reject tasks. |
| `member` | View assigned projects, create and submit tasks for approval. |

Roles are resolved at login from **Entra ID Security Group memberships** — group Object IDs are stored in Azure Key Vault as `entra-group-*` secrets.

---

## 4. How Requests Flow

```
[ Next.js Frontend ] → [ Gateway :8000 ] → [ auth-service :8001 ]
                                         → [ project-service :8002 ]
                                         → [ task-service :8003 ]
                                         → [ analysis-service :8004 ]
                                                    ↓                  ↓
                                           [ Azure AI Foundry ]  [ Azure Blob Storage ]

[ Redis audit_log stream ] ← (published by task, project, auth services)
           ↓
[ Notification Worker ] → [ SMTP Server ] → User inboxes
```

**Key security layer**: The Gateway injects `X-User-ID`, `X-User-Role`, `X-User-Email`, `X-Org-ID` headers into every forwarded request. All downstream services receive these trust headers and do not independently validate the JWT.

**Inter-service authentication**: The Gateway appends the `INTERNAL_API_KEY` header to all forwarded requests. Downstream services reject requests that do not present a valid `INTERNAL_API_KEY`.

---

## 5. Notification Events

The `notification-worker` consumes the `audit_log` Redis stream and sends HTML-branded emails for:

| Event | Email Recipient |
| :--- | :--- |
| `task_created` / `task_assigned` | Task assignee |
| `approval_requested` | Manager (task marked DONE by member) |
| `approval_resolved` | Member (task approved or rejected) |
| `member_added` | Added member |
| `member_removed` | Removed member |
| `member_transferred` | Member (new manager assigned) |
| `user_created` | New user on first Entra SSO login |
| `user_revoked` / `user_activated` | Affected user |
| `project_created` | Org Owner / Platform Admin |

---

## 6. CI/CD & Shift-Left Security

Our GitOps pipeline runs on GitHub Actions:
- **Per-service CI** on push to `Cloud-Track-dev` (path-filtered per service directory).
- **Central Reusable Workflow** (`_ci-reusable.yml`) runs: **SonarQube** → **Snyk** → **Docker Build** → **Trivy** → **OIDC ACR Push** → **Helm values-dev.yaml update** → **Email notification**.
- **Production Release** on published GitHub Release tags (`<service>-v<semver>`): retags the verified Dev SHA → Trivy scan → push → updates `values-prod.yaml` on `main`.

See the **[CI/CD Pipelines & Shift-Left Security Guide](./docs/ci_cd_security.md)** for the full step-by-step breakdown.

---

## 7. Documentation

| Guide | Contents |
| :--- | :--- |
| 📘 [Application Architecture](./docs/application_architecture.md) | Detailed service responsibilities, data models, route descriptions, event handlers. |
| 🚀 [CI/CD & Shift-Left Security](./docs/ci_cd_security.md) | Pipeline steps, Helm GitOps, SonarQube/Snyk/Trivy configuration, production promotion. |
| 🌩️ [Cloud Infrastructure](./docs/cloud_infrastructure.md) | Azure Hub-and-Spoke topology, Private Endpoints, Firewall egress, Workload Identity. |
| 📖 [Deployment Runbook](./docs/deployment_runbook.md) | Step-by-step provisioning from bootstrap to live application. |
| 🔐 [Environment Variables Reference](./docs/environment_variables.md) | Code-verified variable names, defaults, and Key Vault mapping for every service. |

---

## 8. Local Quick Start

```bash
# 1. Copy environment files
cp auth-service/.env.example auth-service/.env
cp project-service/.env.example project-service/.env
cp task-service/.env.example task-service/.env
cp analysis-service/.env.example analysis-service/.env
cp gateway/.env.example gateway/.env

# 2. Edit each .env — ensure JWT_SECRET and INTERNAL_API_KEY match across all services

# 3. Start all services
docker compose up -d

# 4. Open the app
# http://localhost:3000
```

**Default bootstrap accounts** (force password reset required on first login):
- **Platform Admin**: `admin@flowforge.com` / `Admin123!`
- **Org Owner**: `owner@flowforge.com` / `Owner123!`
