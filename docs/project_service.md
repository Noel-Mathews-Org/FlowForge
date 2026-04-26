# Project Service

The Project Service manages workspaces, team memberships, and the approval workflow. It also acts as a consumer of Redis Stream events to send email notifications to project members.

## Technology
- **Framework:** FastAPI (async)
- **ORM:** SQLAlchemy 2.0 with asyncpg
- **Database:** `project_db` on PostgreSQL 16
- **Inter-Service:** HTTP calls to Auth Service and Task Service via `httpx`

## API Endpoints

| Method | Path | Auth | Description |
|:---|:---|:---|:---|
| GET | `/projects/` | Authenticated | List projects (filtered by role) |
| POST | `/projects/` | Manager/Admin | Create a new project |
| GET | `/projects/{id}` | Member+ | Get project details with members |
| PATCH | `/projects/{id}` | Manager/Admin | Update project name/description/archive |
| POST | `/projects/{id}/members` | Manager/Admin | Add a member by email (auto-creates user if needed) |
| GET | `/projects/{id}/members` | Member+ | List project members |
| DELETE | `/projects/{id}/members/{uid}` | Manager/Admin | Remove a member |
| POST | `/projects/request-access` | Authenticated | Request to join a project |
| GET | `/projects/approvals` | Manager/Admin | List pending task approvals |
| POST | `/projects/approvals/{task_id}/approve` | Manager/Admin | Approve a pending task |
| POST | `/projects/approvals/{task_id}/reject` | Manager/Admin | Reject a pending task |

## Database Schema (`project_db`)

### `projects`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Project identifier |
| `name` | VARCHAR(255) | NOT NULL | Project name |
| `description` | TEXT | NULLABLE | Detailed description |
| `manager_id` | UUID | NOT NULL | Owner (references `users.id` in auth_db) |
| `manager_email` | VARCHAR(255) | NOT NULL | Cached manager email |
| `is_archived` | BOOLEAN | default `false` | Archive flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation time |

### `project_members`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Membership ID |
| `project_id` | UUID | FK → `projects.id` (CASCADE) | Parent project |
| `user_id` | UUID | NOT NULL | References `users.id` in auth_db |
| `user_email` | VARCHAR(255) | NOT NULL | Cached email |
| `member_role` | VARCHAR(20) | default `member` | Role within project |
| `joined_at` | TIMESTAMPTZ | NOT NULL | Join time |

**Unique Index:** `(project_id, user_id)` — prevents duplicate memberships.

### `approval_requests`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Request ID |
| `project_id` | UUID | FK → `projects.id` | Target project |
| `requester_id` | UUID | NOT NULL | Requesting user |
| `requester_email` | VARCHAR(255) | NOT NULL | Requester email |
| `status` | ENUM (`PENDING`, `APPROVED`, `REJECTED`) | default `PENDING` | Current state |
| `message` | TEXT | NULLABLE | Request rationale |
| `requested_at` | TIMESTAMPTZ | NOT NULL | Creation time |
| `resolved_at` | TIMESTAMPTZ | NULLABLE | Decision time |
| `resolved_by` | UUID | NULLABLE | Deciding manager |

**Partial Unique Index:** `(project_id, requester_id) WHERE status = 'PENDING'` — one pending request per user per project.

## Communication

### As a Producer
- Publishes `project_created`, `member_added`, `approval_requested` to Redis Stream `audit_log`.
- Publishes `manager_notification` events for real-time manager alerts.

### As a Consumer
- Subscribes to `audit_log` via consumer group `project_notifications`.
- On `task_created`, `task_updated`, `task_moved`, `task_deleted` events: sends email notifications to all project members.

### Inter-Service Calls
- **Auth Service:** `GET /auth/internal/user-by-email` and `POST /auth/internal/create-user` — used when adding a member by email to look up or auto-create the user.
- **Task Service:** `GET /tasks/internal/approvals` and `POST /tasks/internal/{id}/approve|reject` — proxied approval workflow.
