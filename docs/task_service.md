# Task Service

The Task Service is the core productivity engine of FlowForge. It manages the full task lifecycle with Kanban board support, an approval workflow for member-level users, and collaborative commenting.

## Technology
- **Framework:** FastAPI (async)
- **ORM:** SQLAlchemy 2.0 with asyncpg
- **Database:** `task_db` on PostgreSQL 16
- **Event Emission:** Redis Streams via `RedisAuditService`

## API Endpoints

| Method | Path | Auth | Description |
|:---|:---|:---|:---|
| GET | `/tasks/project/{project_id}` | Authenticated | Get Kanban board (grouped by TODO/IN_PROGRESS/DONE) |
| GET | `/tasks/project/{project_id}/pending` | Manager/Admin | List tasks pending approval |
| POST | `/tasks/` | Authenticated | Create a task (members auto-flag `needs_approval`) |
| PUT | `/tasks/{task_id}` | Authenticated | Update task (members can only propose status changes) |
| DELETE | `/tasks/{task_id}` | Manager/Admin | Soft-delete a task |
| POST | `/tasks/{task_id}/approve` | Manager/Admin | Approve a pending task change |
| POST | `/tasks/{task_id}/reject` | Manager/Admin | Reject a pending task change |
| GET | `/tasks/{task_id}` | Authenticated | Get single task with comments |
| POST | `/tasks/{task_id}/comments` | Authenticated | Add a comment to a task |
| GET | `/tasks/{task_id}/comments` | Authenticated | List comments on a task |

## Approval Workflow
When a **member** creates or moves a task:
1. The `needs_approval` flag is set to `true`.
2. The `proposed_status` field stores the desired state.
3. The task stays in its current status until a **manager** approves or rejects.
4. On approval, `proposed_status` is applied and flags are cleared.
5. On rejection, the task remains unchanged and flags are cleared.

**Managers and admins** bypass the approval workflow entirely.

## Database Schema (`task_db`)

### `tasks`
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

### `task_comments`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Comment identifier |
| `task_id` | UUID | FK → `tasks.id` (CASCADE) | Parent task |
| `author_id` | UUID | NOT NULL | Author user ID |
| `author_email` | VARCHAR(320) | NOT NULL | Author email |
| `body` | TEXT | NOT NULL | Comment content |
| `created_at` | TIMESTAMPTZ | NOT NULL | Timestamp |

## Communication

### As a Producer
Publishes to the `audit_log` Redis Stream on every action:
- `task_created` — includes title, status, priority, needs_approval
- `task_moved` — includes old/new status
- `task_deleted` — soft delete event
- `approval_resolved` — includes action (approved/rejected) and new_status

### Outgoing Emails
- Sends notification emails when a task is approved or rejected (to the assignee).
