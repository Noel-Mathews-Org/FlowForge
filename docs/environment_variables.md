# FlowForge Environment Variables Reference

This document provides a code-verified reference for all environment variables used by each FlowForge microservice. In production on AKS, these are fetched at startup from **Azure Key Vault** using `DefaultAzureCredential` (Workload Identity). Locally, they are set in `.env` files.

> **Note**: Services load Key Vault secrets first via `keyvault.py` → `apply_keyvault_secrets()`, which maps Key Vault secret names to environment variable names before the application reads `os.getenv()`.

---

## Key Vault → Environment Variable Mapping

| Azure Key Vault Secret Name | Environment Variable | Used By |
| :--- | :--- | :--- |
| `database-url` | `DATABASE_URL` | auth, project, task, analysis services |
| `redis-url` | `REDIS_URL` | gateway, auth, task, analysis, notification-worker |
| `jwt-secret` | `JWT_SECRET` | gateway, auth-service |
| `internal-api-key` | `INTERNAL_API_KEY` | gateway (sends), all services (verify) |
| `entra-tenant-id` | `ENTRA_TENANT_ID` | auth-service |
| `entra-client-id` | `ENTRA_CLIENT_ID` | auth-service, frontend (baked at build time) |
| `entra-client-secret` | `ENTRA_CLIENT_SECRET` | auth-service |
| `azure-foundry-key` | `AZURE_FOUNDRY_KEY` | analysis-service |
| `azure-foundry-endpoint` | `AZURE_FOUNDRY_ENDPOINT` | analysis-service |
| `smtp-username` | `SMTP_USERNAME` | notification-worker, analysis-service |
| `smtp-password` | `SMTP_PASSWORD` | notification-worker, analysis-service |
| `entra-group-platform-admin` | `ENTRA_GROUP_PLATFORM_ADMIN` | auth-service |
| `entra-group-org-owner` | `ENTRA_GROUP_ORG_OWNER` | auth-service |
| `entra-group-manager` | `ENTRA_GROUP_MANAGER` | auth-service |
| `entra-group-member` | `ENTRA_GROUP_MEMBER` | auth-service |

---

## Per-Service Variable Reference

### Gateway (`gateway/`)

| Variable | Default | Required | Description |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | — | ✅ | Signs and verifies JWT access tokens. Must match auth-service. |
| `REDIS_URL` | `redis://redis:6379` | ✅ | Redis connection for rate-limit counters. |
| `REDIS_PREFIX` | `""` | — | Optional namespace prefix for Redis keys (used in shared clusters). |
| `AUTH_SERVICE_URL` | `http://auth-service:8001` | — | Internal URL of the auth service. |
| `PROJECT_SERVICE_URL` | `http://project-service:8002` | — | Internal URL of the project service. |
| `TASK_SERVICE_URL` | `http://task-service:8003` | — | Internal URL of the task service. |
| `ANALYTICS_SERVICE_URL` | `http://analysis-service:8004` | — | Internal URL of the analysis service. |
| `RATE_LIMIT_REQUESTS` | `100` | — | Number of requests allowed per window. |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | — | Rate limit rolling window in seconds. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | — | Comma-separated CORS allowed origins. |
| `PUBLIC_IP` | — | — | If set, also allows `http://<PUBLIC_IP>:3000` in CORS. |
| `AZURE_KEYVAULT_URL` | — | — | Key Vault URL for secret bootstrapping at startup. |

---

### Auth Service (`auth-service/`)

| Variable | Default | Required | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | — | ✅ | PostgreSQL async connection string (`postgresql+asyncpg://...`). |
| `AZURE_DB_USE_MANAGED_IDENTITY` | `false` | — | Set to `true` in AKS to use passwordless MI auth to PostgreSQL. |
| `AZURE_POSTGRES_HOST` | — | When MI | PostgreSQL server hostname (used when MI auth is enabled). |
| `AZURE_POSTGRES_DB_NAME` | — | When MI | Target database name (used when MI auth is enabled). |
| `AZURE_MANAGED_IDENTITY_NAME` | — | When MI | Client ID of the Managed Identity for DB auth. |
| `JWT_SECRET` | — | ✅ | JWT signing secret. Must match the gateway. |
| `REDIS_URL` | `redis://redis:6379` | — | Redis URL for publishing audit stream events. |
| `REDIS_PREFIX` | `""` | — | Optional namespace prefix for Redis keys. |
| `INTERNAL_API_KEY` | — | ✅ | Validates requests coming from the Gateway. |
| `ENTRA_TENANT_ID` | — | For SSO | Microsoft Entra ID Tenant ID. |
| `ENTRA_CLIENT_ID` | — | For SSO | Entra ID App Registration Client ID. |
| `ENTRA_CLIENT_SECRET` | — | For SSO | Entra ID App Registration Client Secret. |
| `ENTRA_GROUP_PLATFORM_ADMIN` | — | For SSO | Entra Security Group Object ID → `platform_admin`. |
| `ENTRA_GROUP_ORG_OWNER` | — | For SSO | Entra Security Group Object ID → `org_owner`. |
| `ENTRA_GROUP_MANAGER` | — | For SSO | Entra Security Group Object ID → `manager`. |
| `ENTRA_GROUP_MEMBER` | — | For SSO | Entra Security Group Object ID → `member`. |
| `AZURE_KEYVAULT_URL` | — | — | Key Vault URL for secret bootstrapping at startup. |

---

### Project Service (`project-service/`)

| Variable | Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | ✅ | PostgreSQL async connection string. |
| `AZURE_DB_USE_MANAGED_IDENTITY` | — | Set `true` for passwordless MI auth to PostgreSQL. |
| `AZURE_POSTGRES_HOST` / `AZURE_POSTGRES_DB_NAME` / `AZURE_MANAGED_IDENTITY_NAME` | When MI | PostgreSQL MI auth parameters. |
| `INTERNAL_API_KEY` | ✅ | Validates requests from the Gateway. |
| `REDIS_URL` | — | Redis URL for publishing audit stream events. |
| `AZURE_KEYVAULT_URL` | — | Key Vault URL for secret bootstrapping. |

---

### Task Service (`task-service/`)

| Variable | Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | ✅ | PostgreSQL async connection string. |
| `AZURE_DB_USE_MANAGED_IDENTITY` | — | Set `true` for passwordless MI auth to PostgreSQL. |
| `AZURE_POSTGRES_HOST` / `AZURE_POSTGRES_DB_NAME` / `AZURE_MANAGED_IDENTITY_NAME` | When MI | PostgreSQL MI auth parameters. |
| `INTERNAL_API_KEY` | ✅ | Validates requests from the Gateway. |
| `REDIS_URL` | — | Redis URL for publishing task events to the audit stream. |
| `AZURE_KEYVAULT_URL` | — | Key Vault URL for secret bootstrapping. |

---

### Analysis Service (`analysis-service/`)

| Variable | Default | Required | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | — | ✅ (or MI) | PostgreSQL async connection string. |
| `AZURE_DB_USE_MANAGED_IDENTITY` | `false` | — | Enables passwordless MI auth to PostgreSQL. |
| `AZURE_POSTGRES_HOST` / `AZURE_POSTGRES_DB_NAME` / `AZURE_MANAGED_IDENTITY_NAME` | — | When MI | MI auth parameters. |
| `REDIS_URL` | `redis://redis:6379` | — | Redis URL for analytics consumer group. |
| `REDIS_PREFIX` | `""` | — | Namespace prefix for Redis keys. |
| `INTERNAL_API_KEY` | — | ✅ | Validates Gateway requests. |
| `AZURE_FOUNDRY_ENDPOINT` | — | For AI | Azure AI Foundry service endpoint URL. |
| `AZURE_FOUNDRY_KEY` | — | For AI | API Key for Azure AI Foundry. |
| `AZURE_FOUNDRY_DEPLOYMENT` | `summary-agent` | — | Model deployment name in AI Foundry. |
| `AZURE_FOUNDRY_USE_MANAGED_IDENTITY` | `false` | — | Use MI instead of API key for AI Foundry auth. |
| `AZURE_STORAGE_ACCOUNT_NAME` | — | For Blob | Storage account name (needed when using MI). |
| `AZURE_STORAGE_CONNECTION_STRING` | — | For Blob | Storage connection string (used locally/dev). |
| `AZURE_STORAGE_USE_MANAGED_IDENTITY` | `false` | — | Use MI for Blob Storage auth (production). |
| `AZURE_STORAGE_CONTAINER` | `flowforge-reports` | — | Blob container name for reports. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` | — | Optional | SMTP settings for report-generated email sending. |
| `FRONTEND_URL` | `http://localhost:3000` | — | Base URL used in report email links. |
| `AZURE_KEYVAULT_URL` | — | — | Key Vault URL for secret bootstrapping. |

---

### Notification Worker (`notification-worker/`)

| Variable | Default | Required | Description |
| :--- | :--- | :--- | :--- |
| `REDIS_URL` | `redis://redis:6379` | ✅ | Redis connection for reading the `audit_log` stream. |
| `REDIS_PREFIX` | `""` | — | Namespace prefix for Redis stream names. |
| `STREAM_CONSUMER_GROUP` | `{PREFIX}notification-group` | — | Redis consumer group name. |
| `STREAM_CONSUMER_NAME` | `notification-worker-1` | — | Consumer identity inside the group. |
| `SMTP_HOST` | — | For email | SMTP server address (e.g. `smtp.gmail.com`). |
| `SMTP_PORT` | `587` | — | SMTP server port. |
| `SMTP_USERNAME` | — | For email | SMTP authentication username. |
| `SMTP_PASSWORD` | — | For email | SMTP authentication password. |
| `SMTP_FROM_EMAIL` | `SMTP_USERNAME` | — | The "From" email address. |
| `SMTP_FROM_NAME` | `FlowForge` | — | The "From" display name. |
| `FRONTEND_URL` | `http://localhost:3000` | — | Used to generate login/dashboard links in emails. |
| `AZURE_KEYVAULT_URL` | — | — | Key Vault URL for secret bootstrapping. |

---

### Frontend (`frontend/`)

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Gateway public endpoint (e.g. `https://api.flowforge.com`). |
| `NEXT_PUBLIC_ENTRA_CLIENT_ID` | Entra App Registration Client ID — baked into the build at compile time. |
| `NEXT_PUBLIC_ENTRA_TENANT_ID` | Entra Tenant ID — baked into the build at compile time. |
