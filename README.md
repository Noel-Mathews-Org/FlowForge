# FlowForge — DevOps Training Platform

A **multi-tenant microservices platform** built for DevOps training, featuring 4-tier RBAC, AI-powered project summaries, real-time notifications, and a Kanban task management system.

---

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│   Frontend  │───▶│   Gateway    │───▶│   Auth Service   │
│  (Next.js)  │    │  :8000       │    │   :8001          │
└─────────────┘    │  (FastAPI    │    └──────────────────┘
                   │   Proxy)     │───▶│  Project Service │
                   └──────────────┘    │   :8002          │
                          │            └──────────────────┘
                   ┌──────┴─────┐ ───▶│  Task Service    │
                   │   Redis    │     │   :8003          │
                   └──────┬─────┘     └──────────────────┘
                          │      ───▶ │ Analysis Service  │
                          │           │   :8004          │
                          │           └──────────────────┘
                   ┌──────▼─────┐
                   │ Notification│
                   │   Worker   │
                   └────────────┘
```

## Services

| Service | Port | Description |
|---|---|---|
| `gateway` | 8000 | JWT validation, routing, rate limiting |
| `auth-service` | 8001 | Users, invites, sessions, notifications |
| `project-service` | 8002 | Projects, members, archive |
| `task-service` | 8003 | Tasks, comments, approvals |
| `analysis-service` | 8004 | Analytics, AI summaries, aggregation |
| `notification-worker` | — | Redis stream → SMTP email dispatch |
| `frontend` | 3000 | Next.js 14 App Router UI |

## Role Hierarchy

```
platform_admin → org_owner → manager → member
```

| Role | Capabilities |
|---|---|
| `platform_admin` | Full system access, user management, audit logs |
| `org_owner` | Org-wide visibility, invite managers, view all projects |
| `manager` | Create projects, manage tasks, approve member work |
| `member` | View assigned projects, create/update own tasks |

## Quick Start

```bash
# 1. Copy environment files
cp auth-service/.env.example auth-service/.env
cp project-service/.env.example project-service/.env
cp task-service/.env.example task-service/.env
cp analysis-service/.env.example analysis-service/.env
cp gateway/.env.example gateway/.env

# 2. Edit secrets in each .env file (JWT_SECRET, INTERNAL_API_KEY, etc.)

# 3. Start all services
docker compose up -d

# 4. Access the app
open http://localhost:3000

# Default credentials (CHANGE IMMEDIATELY):
# admin@flowforge.com / Admin123!  (platform_admin)
# owner@flowforge.com / Owner123!  (org_owner)
```

Both default accounts require a **force password reset** on first login.

## Key Features

- ✅ **4-Tier RBAC** — platform_admin / org_owner / manager / member
- ✅ **Task Approval Flow** — members submit for review, managers approve/reject
- ✅ **AI Summaries** — GPT-powered project/org summaries (Azure Foundry or OpenAI)
- ✅ **Notification System** — in-app bell + SMTP email for key events
- ✅ **Member Transfer** — org_owner can reassign members between managers
- ✅ **Project Archive** — soft-archive projects while preserving history
- ✅ **Refresh Tokens** — automatic JWT rotation on 401
- ✅ **Force Reset** — new users must set password before accessing any page
- ✅ **Daily Analytics** — midnight UTC aggregation of task/user activity stats
- ✅ **Audit Log** — all sensitive actions streamed to Redis and persisted

## Environment Variables Reference

See `.env.example` in each service directory. Critical shared variables:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | ✅ | Must match across all services |
| `INTERNAL_API_KEY` | ✅ | Service-to-service security token |
| `DATABASE_URL` | ✅ | PostgreSQL async connection URL |
| `REDIS_URL` | ⚠️ Recommended | Redis for streams and rate limiting |
| `SMTP_HOST` | Optional | For email notifications |
| `AZURE_FOUNDRY_ENDPOINT` | Optional | For AI summaries |
| `OPENAI_API_KEY` | Optional | Fallback AI provider |

## Development

```bash
# Individual service hot-reload
cd auth-service && uvicorn main:app --reload --port 8001

# Frontend
cd frontend && npm run dev

# Run aggregation manually (platform_admin token required)
curl -X POST http://localhost:8000/analytics/admin/aggregate \
  -H "Authorization: Bearer <token>"
```
