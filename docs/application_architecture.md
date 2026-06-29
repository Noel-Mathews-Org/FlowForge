# FlowForge — Application Architecture & Microservices Reference

This document provides an accurate, code-verified breakdown of every service in the FlowForge platform, including their responsibilities, frameworks, data models, and how they communicate with each other.

---

## 1. Product Vision

FlowForge is a **self-hosted project management suite** built specifically for organizations within the **Microsoft corporate ecosystem**. It resolves a common problem: teams using Microsoft 365, Azure AD, and Azure services should not need to hand their sensitive project data to third-party SaaS providers.

**Core Benefits:**
- **No new credentials to manage** — Users log in using their existing Microsoft corporate accounts via Entra ID SSO. No separate registration or passwords are required.
- **Zero data egress** — All project data, task history, reports, and AI summaries remain inside your own Azure tenant.
- **Familiar Azure stack** — Uses Entra ID, Azure Blob Storage, Azure AI Foundry (OpenAI), and Azure PostgreSQL — services organizations are already paying for and operating.
- **Lightweight & focused** — Targets small teams, startups, and corporate divisions who want an alternative to complex tools like Jira without the administration overhead.

---

## 2. Role Hierarchy (4-Tier RBAC)

The platform enforces a strict 4-level role hierarchy stored in the database as a PostgreSQL enum:

```
platform_admin  ──►  org_owner  ──►  manager  ──►  member
```

| Role | Capabilities |
| :--- | :--- |
| `platform_admin` | Full system access: audit logs, user management, org administration, aggregation triggers. |
| `org_owner` | Org-wide visibility: invite managers, view all projects, generate reports, manage AI summaries. |
| `manager` | Create projects, manage Kanban boards, invite/transfer members, approve/reject task submissions. |
| `member` | View assigned projects, create tasks, submit tasks for approval, access own Kanban view. |

Roles are mapped at login from **Entra ID Security Groups** via group Object IDs stored in Azure Key Vault (`entra-group-*`).

---

## 3. Microservices

### A. API Gateway (`gateway/` — Port `8000`)

**Framework**: FastAPI (Python)

The Gateway is the single entry point for all client traffic. It acts as a **Backend-for-Frontend (BFF)** proxy:

- **JWT Validation**: All incoming requests must carry a valid JWT Bearer token in the `Authorization` header. The gateway decodes and validates the token using the shared `JWT_SECRET`.
- **Public Routes Bypass**: Specific authentication endpoints bypass JWT validation (login, refresh, invite verification, logout, `/health`).
- **Force-Reset Enforcement**: Users with `must_reset_password=True` in their JWT payload are blocked from all routes except `/force-reset` and `/me`.
- **Rate Limiting**: Enforced per `user_id` (authenticated) or per `client IP` (anonymous) using Redis counters. Default: **100 requests per 60 seconds**.
- **Header Injection**: After validating the JWT, the gateway injects user context into headers for downstream services:
  - `X-User-ID`, `X-User-Role`, `X-User-Email`, `X-Org-ID`, `X-Must-Reset`
- **Request Tracing**: Every request receives a unique `X-Request-ID` UUID header in the response for tracing.
- **Routing Table** (from `config.py`):
  - `/api/auth/*` → `http://auth-service:8001`
  - `/api/project*` or `/api/projects/*` → `http://project-service:8002`
  - `/api/task*` or `/api/tasks/*` → `http://task-service:8003`
  - `/api/analytics/*` → `http://analysis-service:8004`

---

### B. Auth Service (`auth-service/` — Port `8001`)

**Framework**: FastAPI + SQLAlchemy async (Python)

Manages all user identity, organizational structure, and in-app notifications. Contains the following route modules:

**`routes/auth.py`** — Session & Entra ID SSO:
- `POST /api/auth/login` — Standard email/password login. Returns JWT access token + HttpOnly refresh token cookie.
- `POST /api/auth/login/entra` — Microsoft Entra ID SSO flow. Validates the Entra ID token against the configured tenant, resolves the user's role from Entra Security Group membership, and auto-provisions the account on first login.
- `POST /api/auth/refresh` — Issues a new access token using a valid refresh token.
- `POST /api/auth/logout` — Revokes the refresh token from the database.
- `POST /api/auth/force-reset` — Allows users with `must_reset_password=True` to set a new password.
- `GET /api/auth/invite/verify` — Validates an invite token before the user accepts.
- `POST /api/auth/invite/accept` — Accepts an invite, creates the user account, and marks the token as ACCEPTED.

**`routes/users.py`** — User & Organization Management:
- User profile updates, org-level user listing, user activation/deactivation.
- Member transfer between managers (`org_owner` only).
- Audit log access.

**`routes/internal.py`** — Internal API (Gateway → Auth):
- `POST /internal/notifications` — Creates in-app notification records. Called by other services to notify users.

**Database Models** (from `models.py`):
- **`User`** — Stores user UUID, org_id, email, bcrypt-hashed password, role, manager_id, Entra OID, and `must_reset_password` flag.
- **`Invitation`** — Tracks invite tokens with status: `PENDING`, `ACCEPTED`, `EXPIRED`, `CANCELLED`.
- **`Notification`** — Stores in-app notification bell records (type, title, content, JSONB payload, `is_read` flag).
- **`RefreshToken`** — Stores hashed refresh tokens with expiry and revocation status.

---

### C. Project Service (`project-service/` — Port `8002`)

**Framework**: FastAPI + SQLAlchemy async (Python)

Manages the core project workspace structure:
- CRUD operations for Projects and their metadata.
- Project membership: adding/removing members, controlling who has access to each workspace.
- Project soft-archiving — preserves history while removing from active boards.
- Publishes events to the Redis `audit_log` stream on project creation and membership changes.

---

### D. Task Service (`task-service/` — Port `8003`)

**Framework**: FastAPI + SQLAlchemy async (Python)

Implements the Kanban board and task lifecycle:
- Task creation, update, status transitions.
- Task commenting and threaded discussions.
- **Approval Gate Flow**: When a `member` marks a task as `DONE`, it enters a `PENDING_APPROVAL` state. The assigned manager can `approve` or `reject` the submission.
- Publishes events to the Redis `audit_log` stream (`task_created`, `task_assigned`, `approval_requested`, `approval_resolved`).

---

### E. Analysis Service (`analysis-service/` — Port `8004`)

**Framework**: FastAPI + SQLAlchemy async (Python)

Integrates with Azure AI Foundry and Azure Blob Storage to deliver analytics and AI capabilities:

**`routes/analytics.py`** — Metrics & Aggregation:
- Serves daily task completion metrics, org-level productivity data.
- Provides a manual aggregation trigger (`POST /analytics/admin/aggregate`) for `platform_admin`.

**`routes/ai.py`** — AI Summary Generation:
- Calls the Azure AI Foundry (`summary-agent` deployment) using the `AZURE_FOUNDRY_ENDPOINT` and `AZURE_FOUNDRY_KEY`.
- Generates project progress summaries, org-level AI digests.
- Supports **Managed Identity authentication** to Azure AI Foundry (`AZURE_FOUNDRY_USE_MANAGED_IDENTITY=true`).

**`routes/reports.py`** — Report Generation & Storage:
- Compiles reports from database analytics.
- Writes reports to **Azure Blob Storage** (container: `flowforge-reports`).
- Uses **passwordless Managed Identity** to write blobs (`AZURE_STORAGE_USE_MANAGED_IDENTITY=true`).
- When `report_generated` events are published to Redis, the Notification Worker emails the org owner a download link.

---

### F. Notification Worker (`notification-worker/`)

**Framework**: Pure Python asyncio (no HTTP server — background process)

Subscribes to the Redis `audit_log` stream as a consumer group and dispatches SMTP email notifications. It does **not** serve an HTTP API; it runs as an event consumer loop.

**Stream Name**: `{REDIS_PREFIX}audit_log`
**Consumer Group**: `{REDIS_PREFIX}notification-group`

**Event Handlers** (from `worker.py`):

| Redis Event | Recipient | Email Description |
| :--- | :--- | :--- |
| `task_created` / `task_assigned` | Assignee | "New Task Assigned" with task title and priority. |
| `approval_requested` | Manager | "Approval Needed" when a member marks a task as DONE. |
| `approval_resolved` | Assignee | "Task Approved ✅" or "Task Rejected ❌". |
| `member_added` | Added member | "Added to Project: \<name\>" notification. |
| `member_removed` | Removed member | "Removed from Project: \<name\>" notification. |
| `member_transferred` | Transferred member | "Manager Reassignment" with new manager name. |
| `user_created` | New user | "Welcome to FlowForge!" on first Entra ID auto-provision. |
| `user_revoked` | Revoked user | "Account Access Revoked" notification. |
| `user_activated` | Reactivated user | "Account Reactivated" with login link. |
| `project_created` | Admin/Org Owner | "New Project Created" with creator details. |

Emails are styled HTML templates with the FlowForge brand gradient. If SMTP is not configured, the worker logs a debug message and continues processing without failing.

---

### G. Frontend (`frontend/` — Port `3000`)

**Framework**: React / Next.js 14 App Router

The UI client for FlowForge. Key characteristics:
- Entra ID SSO parameters (`NEXT_PUBLIC_ENTRA_CLIENT_ID`, `NEXT_PUBLIC_ENTRA_TENANT_ID`) are baked into the build at compile-time as `NEXT_PUBLIC_*` environment variables.
- In the CI pipeline, values are read from `Helm/values-dev.yaml` (dev) or `Helm/values-prod.yaml` (prod) before the Docker build.
- Communicates exclusively with the Gateway (`NEXT_PUBLIC_API_URL`).

---

## 4. Inter-Service Communication

```text
  [ Next.js Frontend (Port 3000) ]
             │
             │ JWT Bearer Token
             ▼
  [ FastAPI Gateway (Port 8000) ]
        ├── Rate limit check ─────────────► [ Redis ]
        │                                     ▲
        │ Injects X-User-* + INTERNAL_API_KEY │
        │                                     │ audit_log stream
        ├──► [ Auth Service :8001 ] ──────────┤
        ├──► [ Project Service :8002 ] ────────┤
        ├──► [ Task Service :8003 ] ───────────┘
        └──► [ Analysis Service :8004 ]
                    │
                    ├──► [ Azure AI Foundry ] (outbound HTTPS)
                    └──► [ Azure Blob Storage ] (outbound via Private Endpoint)

  [ Redis audit_log stream ]
             │
             ▼
  [ Notification Worker ] ──► [ SMTP Server ]
```

**Security between services**:
- All downstream services are only reachable inside the Kubernetes cluster (ClusterIP services).
- The Gateway appends the `INTERNAL_API_KEY` header to all forwarded requests.
- Downstream services validate the `INTERNAL_API_KEY` header before processing requests.
