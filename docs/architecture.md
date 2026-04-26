# FlowForge — Application Architecture & System Design

FlowForge is an enterprise-grade, event-driven project and task management platform built on a microservices architecture. It enables teams to collaborate through projects, manage tasks via a Kanban board, and gain real-time productivity insights through an analytics dashboard.

---

## 1. High-Level Architecture

```
                          INTERNET
                             |
                        [ HAProxy ]           <-- SSL/TLS Termination
                             |
                         HTTP (80)
                             |
                      +--------------+
                      | API Gateway  |        <-- JWT Auth, Rate Limiting, Routing
                      |  (FastAPI)   |
                      +--------------+
                             |
          +------------------+------------------+------------------+
          |                  |                  |                  |
    /api/auth/*       /api/projects/*     /api/tasks/*     /api/analytics/*
          |                  |                  |                  |
   +-----------+     +--------------+    +------------+    +----------------+
   |   Auth    |     |   Project    |    |    Task    |    |   Analysis     |
   |  Service  |     |   Service    |    |   Service  |    |   Service      |
   +-----------+     +--------------+    +------------+    +----------------+
          |                  |                  |                  |
       auth_db          project_db          task_db          analytics_db
          |                  |                  |                  |
          +------------------+------------------+------------------+
                             |
                     [ PostgreSQL 16 ]
                     (Single Instance)


   Event Flow (Redis Streams):

   Task Service ---[XADD]--> audit_log ---[XREADGROUP]--> Analysis Service
                                      \--[XREADGROUP]--> Project Service

   API Gateway ---[GET/SET]--> Redis (Rate Limiting)
```

### Infrastructure Components

| Component | Responsibility |
|:---|:---|
| **HAProxy** | SSL/TLS termination at the edge. All internal cluster traffic is plain HTTP. |
| **Kubernetes Services** | Internal load balancing across pod replicas. The API Gateway does not perform load balancing. |
| **Argo CD** | GitOps-based continuous deployment. `test` branch syncs to `dev` namespace, `prod` branch syncs to `prod` namespace. |
| **Bitnami Sealed Secrets** | Encrypts secrets in Git. Only the in-cluster controller can decrypt them. |
| **Kyverno** | Enforces the `disallow-latest-tag` cluster policy. All container images must use specific, immutable tags. |

---

## 2. Database Architecture

FlowForge uses a single PostgreSQL 16 instance with **four logical databases**, one per service. Each service owns its schema exclusively.

### 2.1 auth_db

#### Table: `users`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Unique user identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL, INDEX | Login email |
| `hashed_password` | VARCHAR(255) | NOT NULL | bcrypt hash |
| `full_name` | VARCHAR(255) | NOT NULL | Display name |
| `role` | ENUM (`admin`, `manager`, `member`) | NOT NULL | System-wide role |
| `org` | VARCHAR(255) | NOT NULL, default `flowforge` | Organization |
| `is_active` | BOOLEAN | NOT NULL, default `true` | Account status |
| `created_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | Registration timestamp |

#### Table: `refresh_tokens`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Token identifier |
| `user_id` | UUID | FK -> `users.id`, INDEX | Token owner |
| `token` | VARCHAR(255) | UNIQUE, INDEX | Refresh token string |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Expiration time |
| `revoked` | BOOLEAN | default `false` | Invalidation flag |

#### Table: `invite_tokens`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Token identifier |
| `token` | VARCHAR(255) | UNIQUE, INDEX | Secret URL token |
| `email` | VARCHAR(255) | NOT NULL | Target email address |
| `role` | ENUM (`manager`, `member`) | NOT NULL | Role assigned on registration |
| `created_by` | UUID | FK -> `users.id` | Inviting user |
| `used` | BOOLEAN | default `false` | Whether token was consumed |
| `expires_at` | TIMESTAMPTZ | NOT NULL | 72-hour expiry |

**Relationships:** `users` 1--* `refresh_tokens` (via `user_id`), `users` 1--* `invite_tokens` (via `created_by`)

---

### 2.2 project_db

#### Table: `projects`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Project identifier |
| `name` | VARCHAR(255) | NOT NULL | Project name |
| `description` | TEXT | NULLABLE | Detailed description |
| `manager_id` | UUID | NOT NULL | Owner (references `users.id` in auth_db) |
| `manager_email` | VARCHAR(255) | NOT NULL | Cached manager email |
| `is_archived` | BOOLEAN | default `false` | Archive flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |

#### Table: `project_members`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Membership identifier |
| `project_id` | UUID | FK -> `projects.id` (CASCADE) | Parent project |
| `user_id` | UUID | NOT NULL | References `users.id` in auth_db |
| `user_email` | VARCHAR(255) | NOT NULL | Cached email |
| `member_role` | VARCHAR(20) | default `member` | Role within project |
| `joined_at` | TIMESTAMPTZ | NOT NULL | Join timestamp |

**Unique Index:** `(project_id, user_id)` — prevents duplicate memberships.

#### Table: `approval_requests`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Request identifier |
| `project_id` | UUID | FK -> `projects.id` | Target project |
| `requester_id` | UUID | NOT NULL | Requesting user |
| `requester_email` | VARCHAR(255) | NOT NULL | Requester email |
| `status` | ENUM (`PENDING`, `APPROVED`, `REJECTED`) | default `PENDING` | Current state |
| `message` | TEXT | NULLABLE | Request rationale |
| `requested_at` | TIMESTAMPTZ | NOT NULL | Submission time |
| `resolved_at` | TIMESTAMPTZ | NULLABLE | Decision time |
| `resolved_by` | UUID | NULLABLE | Deciding manager |

**Partial Unique Index:** `(project_id, requester_id) WHERE status = 'PENDING'` — one pending request per user per project.

**Relationships:** `projects` 1--* `project_members` (via `project_id`), `projects` 1--* `approval_requests` (via `project_id`)

---

### 2.3 task_db

#### Table: `tasks`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Task identifier |
| `project_id` | UUID | NOT NULL, INDEX | References `projects.id` in project_db |
| `title` | VARCHAR(255) | NOT NULL | Task summary |
| `description` | TEXT | NULLABLE | Detailed requirements |
| `status` | ENUM (`TODO`, `IN_PROGRESS`, `DONE`) | default `TODO` | Current Kanban column |
| `priority` | ENUM (`LOW`, `MEDIUM`, `HIGH`) | default `MEDIUM` | Task priority |
| `assignee_id` | UUID | NULLABLE | Assigned user |
| `assignee_email` | VARCHAR(320) | NULLABLE | Assignee email (cached) |
| `created_by` | UUID | NOT NULL | Creator user ID |
| `created_by_email` | VARCHAR(320) | NOT NULL | Creator email |
| `position` | INTEGER | default `0` | Kanban sort order |
| `needs_approval` | BOOLEAN | default `false` | Pending manager review |
| `proposed_status` | VARCHAR(50) | NULLABLE | Status the member wants |
| `proposed_by` | UUID | NULLABLE | Member who proposed the change |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last modification |
| `deleted_at` | TIMESTAMPTZ | NULLABLE | Soft-delete timestamp |

#### Table: `task_comments`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Comment identifier |
| `task_id` | UUID | FK -> `tasks.id` (CASCADE) | Parent task |
| `author_id` | UUID | NOT NULL | Author user ID |
| `author_email` | VARCHAR(320) | NOT NULL | Author email |
| `body` | TEXT | NOT NULL | Comment content |
| `created_at` | TIMESTAMPTZ | NOT NULL | Timestamp |

**Relationships:** `tasks` 1--* `task_comments` (via `task_id`)

---

### 2.4 analytics_db

#### Table: `audit_events`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Event identifier |
| `event_type` | VARCHAR(100) | NOT NULL | e.g., `task_created`, `member_added` |
| `user_id` | VARCHAR(64) | NOT NULL | Actor user ID |
| `user_email` | VARCHAR(320) | NOT NULL | Actor email |
| `project_id` | VARCHAR(64) | NULLABLE | Associated project |
| `task_id` | VARCHAR(64) | NULLABLE | Associated task |
| `metadata` | JSON | NOT NULL, default `{}` | Event-specific payload |
| `occurred_at` | TIMESTAMPTZ | NOT NULL | When the event happened in the source |
| `ingested_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | When Analysis recorded it |

#### Table: `daily_task_stats`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Row identifier |
| `date` | DATE | NOT NULL | Calendar day |
| `project_id` | VARCHAR(64) | NOT NULL | Project being tracked |
| `tasks_created` | INTEGER | default `0` | New tasks count |
| `tasks_completed` | INTEGER | default `0` | Tasks moved to DONE |
| `tasks_in_progress` | INTEGER | default `0` | Tasks moved to IN_PROGRESS |

**Unique Constraint:** `(date, project_id)`

#### Table: `user_activity_stats`

| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Row identifier |
| `user_id` | VARCHAR(64) | NOT NULL | User being tracked |
| `user_email` | VARCHAR(320) | NOT NULL | Cached email |
| `date` | DATE | NOT NULL | Calendar day |
| `events_count` | INTEGER | default `0` | Total events by user |
| `tasks_created` | INTEGER | default `0` | Tasks created |
| `tasks_completed` | INTEGER | default `0` | Tasks completed |

**Unique Constraint:** `(user_id, date)`

---

### 2.5 Cross-Service Data References

These are logical references. No foreign keys exist across databases.

| Source Table | Field | References | Target Database |
|:---|:---|:---|:---|
| `project_members.user_id` | UUID | `users.id` | auth_db |
| `projects.manager_id` | UUID | `users.id` | auth_db |
| `tasks.project_id` | UUID | `projects.id` | project_db |
| `tasks.assignee_id` | UUID | `users.id` | auth_db |
| `tasks.created_by` | UUID | `users.id` | auth_db |
| `audit_events.project_id` | VARCHAR | `projects.id` | project_db |
| `audit_events.task_id` | VARCHAR | `tasks.id` | task_db |
| `audit_events.user_id` | VARCHAR | `users.id` | auth_db |

### 2.6 Entity-Relationship Diagram

```
  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
  │  auth_db                                                                                    │
  │                                                                                             │
  │   ┌──────────────────┐          ┌─────────────────────┐          ┌──────────────────────┐   │
  │   │      users       │          │   refresh_tokens     │          │    invite_tokens      │   │
  │   ├──────────────────┤          ├─────────────────────┤          ├──────────────────────┤   │
  │   │ id (PK)          │──1───*──>│ user_id (FK)        │          │ id (PK)              │   │
  │   │ email (UNIQUE)   │          │ id (PK)             │          │ token (UNIQUE)       │   │
  │   │ hashed_password  │          │ token (UNIQUE)      │          │ email                │   │
  │   │ full_name        │          │ expires_at           │          │ role                 │   │
  │   │ role (ENUM)      │          │ revoked              │          │ created_by (FK)──────│───┘
  │   │ org              │──1───*──>└─────────────────────┘          │ used                 │
  │   │ is_active        │                                           │ expires_at           │
  │   │ created_at       │                                           └──────────────────────┘
  │   └──────────────────┘
  └────────────┬────────────────────────────────────────────────────────────────────────────────┘
               │ (logical reference via user_id / manager_id)
               │
  ┌────────────▼────────────────────────────────────────────────────────────────────────────────┐
  │  project_db                                                                                 │
  │                                                                                             │
  │   ┌──────────────────┐          ┌─────────────────────┐          ┌──────────────────────┐   │
  │   │    projects       │          │  project_members     │          │  approval_requests    │   │
  │   ├──────────────────┤          ├─────────────────────┤          ├──────────────────────┤   │
  │   │ id (PK)          │──1───*──>│ project_id (FK)     │          │ project_id (FK)──────│───┐
  │   │ name             │          │ id (PK)             │          │ id (PK)              │   │
  │   │ description      │          │ user_id             │          │ requester_id         │   │
  │   │ manager_id       │          │ user_email           │          │ requester_email      │   │
  │   │ manager_email    │──1───*──>│ member_role          │          │ status (ENUM)        │   │
  │   │ is_archived      │          │ joined_at            │          │ message              │   │
  │   │ created_at       │          └─────────────────────┘          │ requested_at         │   │
  │   └──────────────────┘◄──1───*───────────────────────────────────│ resolved_at          │   │
  │                                                                  │ resolved_by          │   │
  │                                                                  └──────────────────────┘   │
  └────────────┬────────────────────────────────────────────────────────────────────────────────┘
               │ (logical reference via project_id)
               │
  ┌────────────▼────────────────────────────────────────────────────────────────────────────────┐
  │  task_db                                                                                    │
  │                                                                                             │
  │   ┌──────────────────────┐          ┌─────────────────────┐                                 │
  │   │       tasks           │          │   task_comments      │                                 │
  │   ├──────────────────────┤          ├─────────────────────┤                                 │
  │   │ id (PK)              │──1───*──>│ task_id (FK)        │                                 │
  │   │ project_id           │          │ id (PK)             │                                 │
  │   │ title                │          │ author_id            │                                 │
  │   │ description          │          │ author_email         │                                 │
  │   │ status (ENUM)        │          │ body                 │                                 │
  │   │ priority (ENUM)      │          │ created_at           │                                 │
  │   │ assignee_id          │          └─────────────────────┘                                 │
  │   │ created_by           │                                                                  │
  │   │ position             │                                                                  │
  │   │ needs_approval       │                                                                  │
  │   │ proposed_status      │                                                                  │
  │   │ deleted_at (soft)    │                                                                  │
  │   └──────────────────────┘                                                                  │
  └────────────┬────────────────────────────────────────────────────────────────────────────────┘
               │ (logical reference via project_id, task_id, user_id)
               │
  ┌────────────▼────────────────────────────────────────────────────────────────────────────────┐
  │  analytics_db                                                                               │
  │                                                                                             │
  │   ┌──────────────────────┐  ┌─────────────────────┐  ┌───────────────────────┐              │
  │   │    audit_events       │  │  daily_task_stats    │  │  user_activity_stats   │              │
  │   ├──────────────────────┤  ├─────────────────────┤  ├───────────────────────┤              │
  │   │ id (PK)              │  │ id (PK)             │  │ id (PK)               │              │
  │   │ event_type           │  │ date                │  │ user_id               │              │
  │   │ user_id              │  │ project_id          │  │ user_email            │              │
  │   │ user_email           │  │ tasks_created       │  │ date                  │              │
  │   │ project_id           │  │ tasks_completed     │  │ events_count          │              │
  │   │ task_id              │  │ tasks_in_progress   │  │ tasks_created         │              │
  │   │ metadata (JSON)      │  └─────────────────────┘  │ tasks_completed       │              │
  │   │ occurred_at          │                            └───────────────────────┘              │
  │   │ ingested_at          │                                                                  │
  │   └──────────────────────┘                                                                  │
  └─────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Event-Driven Communication

FlowForge uses **Redis Streams** as its asynchronous event bus. The stream name is `audit_log`.

### Event Flow

```
1. User moves a task to DONE in the frontend.
2. Task Service updates the database and publishes to Redis:
      XADD audit_log * event_type task_moved project_id <uuid> ...
3. Analysis Service (consumer group: analytics_consumers) reads the event:
      - Inserts an AuditEvent record.
      - Increments daily_task_stats.tasks_completed.
      - Increments user_activity_stats.tasks_completed.
4. Project Service (consumer group: project_notifications) reads the same event:
      - Queries all ProjectMembers for the project.
      - Sends a branded email notification to each member.
```

### Event Type Reference

| Event | Producer | Consumers | Description |
|:---|:---|:---|:---|
| `task_created` | Task Service | Analysis, Project | A new task was created |
| `task_moved` | Task Service | Analysis, Project | Task status changed |
| `task_deleted` | Task Service | Analysis | Task was soft-deleted |
| `task_updated` | Task Service | Analysis | Task fields were modified |
| `approval_resolved` | Task Service | Analysis | Manager approved or rejected a task |
| `project_created` | Project Service | Analysis | A new project was created |
| `member_added` | Project Service | Analysis | A user was added to a project |
| `approval_requested` | Project Service | Analysis | User requested project access |

---

## 4. Microservices Summary

| Service | Internal Port | Database | Key Responsibility |
|:---|:---|:---|:---|
| API Gateway | 8000 | None (stateless) | Routing, JWT validation, rate limiting |
| Auth Service | 8000 | `auth_db` | User identity, JWT issuance, invitations |
| Project Service | 8000 | `project_db` | Workspaces, memberships, approval proxying |
| Task Service | 8000 | `task_db` | Kanban board, task CRUD, event emission |
| Analysis Service | 8000 | `analytics_db` | Audit logging, daily stats, stream consumption |
| Frontend | 3000 | None | Next.js SPA, Kanban UI, admin dashboards |

For detailed documentation on each service, see:

- [Auth Service](./auth_service.md)
- [Project Service](./project_service.md)
- [Task Service](./task_service.md)
- [Analysis Service](./analysis_service.md)
- [API Gateway](./gateway.md)
- [Frontend](./frontend.md)

---

## 5. Default Seed Users

The system is initialized via `postgres-initdb-cm.yaml` with three users:

| Email | Role | Purpose |
|:---|:---|:---|
| `admin@flow.com` | Admin | Full system access. Can manage all projects, users, and view analytics. |
| `manager@flow.com` | Manager | Can create projects, manage members, and approve/reject task changes. |
| `user@flow.com` | Member | Can view assigned projects, create tasks, and propose status changes (requires approval). |

---

## 6. Technology Stack

| Layer | Technology |
|:---|:---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| **Frontend** | Next.js, React, TailwindCSS |
| **Database** | PostgreSQL 16 Alpine (StatefulSet with NFS-CSI PVC) |
| **Cache / Events** | Redis 7 Alpine (Streams for events, key-value for rate limiting) |
| **Authentication** | JWT (HS256), bcrypt password hashing |
| **Orchestration** | Kubernetes, Helm 3, Argo CD |
| **CI/CD** | GitHub Actions, Docker, GitHub Container Registry (GHCR) |
| **Security** | Bitnami SealedSecrets, Kyverno, HAProxy (TLS termination) |
| **Monitoring** | Prometheus, Grafana (kube-prometheus-stack), Loki |
