# Analysis Service

The Analysis Service provides observability and auditability. It consumes every event from Redis Streams, persists them as immutable audit logs, and aggregates daily productivity metrics.

## Technology
- **Framework:** FastAPI (async)
- **ORM:** SQLAlchemy 2.0 with asyncpg
- **Database:** `analytics_db` on PostgreSQL 16
- **Stream Consumer:** Background asyncio task using Redis `XREADGROUP`

## API Endpoints

| Method | Path | Auth | Description |
|:---|:---|:---|:---|
| GET | `/analytics/overview` | Admin | System-wide stats (total tasks, completion rate, active users) |
| GET | `/analytics/task-throughput?days=7` | Admin | Daily task creation/completion graph data |
| GET | `/analytics/user-activity?days=7` | Admin | Top active users ranked by event count |
| GET | `/analytics/events` | Admin | Paginated audit event log with filters |
| GET | `/analytics/audit-log` | Admin | Alias for `/events` (frontend compatibility) |
| GET | `/analytics/project/{id}/stats` | Admin | 30-day stats for a specific project |

## Database Schema (`analytics_db`)

### `audit_events`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Event identifier |
| `event_type` | VARCHAR(100) | NOT NULL | e.g., `task_created`, `member_added` |
| `user_id` | VARCHAR(64) | NOT NULL | Actor's user ID |
| `user_email` | VARCHAR(320) | NOT NULL | Actor's email |
| `project_id` | VARCHAR(64) | NULLABLE | Associated project |
| `task_id` | VARCHAR(64) | NULLABLE | Associated task |
| `metadata` | JSON | NOT NULL, default `{}` | Event-specific data (title, status, etc.) |
| `occurred_at` | TIMESTAMPTZ | NOT NULL | When the event happened in the source service |
| `ingested_at` | TIMESTAMPTZ | NOT NULL, default `NOW()` | When the Analysis service recorded it |

### `daily_task_stats`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Row identifier |
| `date` | DATE | NOT NULL | The calendar day |
| `project_id` | VARCHAR(64) | NOT NULL | Project being tracked |
| `tasks_created` | INTEGER | default `0` | Count of new tasks |
| `tasks_completed` | INTEGER | default `0` | Count moved to DONE |
| `tasks_in_progress` | INTEGER | default `0` | Count moved to IN_PROGRESS |

**Unique Constraint:** `(date, project_id)` — one row per project per day.

### `user_activity_stats`
| Column | Type | Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | PK | Row identifier |
| `user_id` | VARCHAR(64) | NOT NULL | User being tracked |
| `user_email` | VARCHAR(320) | NOT NULL | Cached email |
| `date` | DATE | NOT NULL | The calendar day |
| `events_count` | INTEGER | default `0` | Total events by this user |
| `tasks_created` | INTEGER | default `0` | Tasks created by user |
| `tasks_completed` | INTEGER | default `0` | Tasks completed by user |

**Unique Constraint:** `(user_id, date)` — one row per user per day.

## Stream Consumer Logic

The consumer runs as a background `asyncio.create_task` on startup:

1. Creates consumer group `analytics_consumers` on stream `audit_log`.
2. Reads messages in batches of 10 with a 1-second block timeout.
3. For each message:
   - Inserts an `AuditEvent` record.
   - Upserts `DailyTaskStats` (increments counters based on event type).
   - Upserts `UserActivityStats` (increments per-user counters).
4. Acknowledges the message with `XACK`.
5. On processing failure: rolls back the DB transaction but still ACKs the message to prevent poison-pill blocking.

## Communication
- **Consumer only:** Does not produce events. Only reads from Redis Streams.
- **REST API:** Exposes read-only analytics endpoints to the frontend (admin-only).
