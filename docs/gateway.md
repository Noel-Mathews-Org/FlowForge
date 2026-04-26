# API Gateway

The API Gateway is the single entry point for all external traffic. It handles authentication, rate limiting, request routing, and header injection.

## Technology
- **Framework:** FastAPI with custom middleware
- **Proxy:** `httpx.AsyncClient` for async request forwarding
- **Rate Limiting:** Redis-backed sliding window counters
- **Auth:** JWT validation (HS256) using the shared `JWT_SECRET`

## Responsibilities

| Responsibility | How |
|:---|:---|
| **Routing** | Forwards `/api/auth/*`, `/api/projects/*`, `/api/tasks/*`, `/api/analytics/*` to upstream services |
| **Authentication** | Extracts `Bearer` token, validates JWT, rejects expired/invalid tokens |
| **Header Injection** | Injects `X-User-ID`, `X-User-Role`, `X-User-Email`, `X-User-Org` into upstream requests |
| **Rate Limiting** | Redis-based per-user/per-IP rate limits with `X-RateLimit-*` response headers |
| **CORS** | Configurable `allowed_origins` with credentials support |
| **Request Tracking** | Assigns a `X-Request-ID` UUID to every request for distributed tracing |
| **Error Handling** | Consistent JSON error responses with error codes and request IDs |

## What the Gateway Does NOT Do

| Concern | Handled By |
|:---|:---|
| **SSL/TLS Termination** | HAProxy (edge proxy) |
| **Load Balancing** | Kubernetes Services (kube-proxy / CNI) |
| **Service Discovery** | Kubernetes DNS (`auth-service.dev.svc.cluster.local`) |

## Public Routes (No Auth Required)
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /health`

## Middleware Stack (execution order)
1. **Request Context** — assigns `request_id` and initializes `user_id` as `anonymous`.
2. **Logging** — logs method, path, status code, duration, and user ID.
3. **Route Handler** — validates JWT (if not public), checks rate limit, forwards to upstream.
