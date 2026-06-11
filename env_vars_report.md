# FlowForge Environment Variables Mapping Report

This report maps the exact environment variables required by each microservice in the FlowForge application. It also clarifies whether each variable is typically injected via the **Helm ConfigMap (`flowforge-config`)** or securely fetched from **Azure Key Vault**.

---

## 1. Auth Service (`auth-service`)

**Purpose**: Handles authentication, user management, and JWT token issuance.

| Environment Variable | Source / Fetch Location | Description |
| :--- | :--- | :--- |
| `JWT_SECRET` | **Key Vault** (`jwt-secret`) | Used to sign and verify JWT tokens. (Required) |
| `INTERNAL_API_KEY` | **Key Vault** (`internal-api-key`) | For secure service-to-service communication. (Required) |
| `DATABASE_URL` | **Key Vault** (`database-url-auth` / `database-url`) | PostgreSQL connection string. (Required) |
| `REDIS_URL` | **Key Vault** (`redis-url`) | Redis cache connection string. |
| `ENTRA_CLIENT_SECRET` | **Key Vault** (`entra-client-secret`) | Azure AD Application Client Secret. |
| `ENTRA_TENANT_ID` | **ConfigMap** (`ENTRA_TENANT_ID`) | Azure AD Tenant ID. |
| `ENTRA_CLIENT_ID` | **ConfigMap** (`ENTRA_CLIENT_ID`) | Azure AD Client ID. |
| `ENTRA_GROUP_PLATFORM_ADMIN` | **Key Vault** (`entra-group-platform-admin`) | Object ID for the Platform Admin Entra Group. |
| `ENTRA_GROUP_ORG_OWNER` | **Key Vault** (`entra-group-org-owner`) | Object ID for the Org Owner Entra Group. |
| `ENTRA_GROUP_MANAGER` | **Key Vault** (`entra-group-manager`)| Object ID for the Manager Entra Group. |
| `ENTRA_GROUP_MEMBER` | **Key Vault** (`entra-group-member`) | Object ID for the Member Entra Group. |
| `SMTP_PASSWORD` | **Key Vault** (`smtp-password`) | Password for SMTP. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME` | **ConfigMap** / Key Vault | SMTP configuration for email delivery. |
| `FRONTEND_URL` | **ConfigMap** (`FRONTEND_URL`) | The URL of the Next.js frontend. |
| `APP_PORT` | **ConfigMap** (`APP_PORT`) | Port the auth-service listens on (default: `8001`). |
| `AZURE_KEYVAULT_URL` | **ConfigMap** | Triggers the service to fetch the Key Vault secrets on boot. |

---

## 2. Gateway (`gateway`)

**Purpose**: Central routing, API Gateway, rate limiting, and CORS validation.

| Environment Variable | Source / Fetch Location | Description |
| :--- | :--- | :--- |
| `JWT_SECRET` | **Key Vault** (`jwt-secret`) | Used to validate JWT tokens on protected routes. (Required) |
| `REDIS_URL` | **Key Vault** (`redis-url`) | Used for rate-limiting via Redis. |
| `AUTH_SERVICE_URL` | **ConfigMap** | Internal cluster DNS for auth service. |
| `PROJECT_SERVICE_URL` | **ConfigMap** | Internal cluster DNS for project service. |
| `TASK_SERVICE_URL` | **ConfigMap** | Internal cluster DNS for task service. |
| `ANALYTICS_SERVICE_URL` | **ConfigMap** | Internal cluster DNS for analytics service. |
| `RATE_LIMIT_REQUESTS` | **ConfigMap** | Number of requests allowed per window. |
| `RATE_LIMIT_WINDOW_SECONDS` | **ConfigMap** | Time window for rate limiting. |
| `ALLOWED_ORIGINS` | **ConfigMap** | Used to configure CORS policies. |
| `GATEWAY_PORT` | **ConfigMap** (`GATEWAY_PORT`) | Port the gateway listens on (default: `8000`). |

---

## 3. Project Service (`project-service`)

**Purpose**: Handles organizations, projects, and member assignments.

| Environment Variable | Source / Fetch Location | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Key Vault** (`database-url`) | PostgreSQL connection string. (Required) |
| `INTERNAL_API_KEY` | **Key Vault** (`internal-api-key`) | For secure internal requests. |
| `REDIS_URL` | **Key Vault** (`redis-url`) | Redis cache connection string. |
| `TASK_SERVICE_URL` | **ConfigMap** | URL to communicate with task-service. |
| `FRONTEND_URL` | **ConfigMap** | Used for generating frontend links. |
| `SMTP_*` (Host, User, Pass) | **ConfigMap** & **Key Vault** | SMTP details for triggering specific alerts. |

---

## 4. Task Service (`task-service`)

**Purpose**: Handles tasks, workflows, and task approvals.

| Environment Variable | Source / Fetch Location | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Key Vault** (`database-url`) | PostgreSQL connection string. (Required) |
| `INTERNAL_API_KEY` | **Key Vault** (`internal-api-key`) | For secure internal requests. |
| `REDIS_URL` | **Key Vault** (`redis-url`) | Redis cache connection string. |

---

## 5. Analysis Service (`analysis-service`)

**Purpose**: Azure AI Foundry integration and report generation.

| Environment Variable | Source / Fetch Location | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Key Vault** (`database-url-analytics`) | PostgreSQL connection string. (Required) |
| `INTERNAL_API_KEY` | **Key Vault** (`internal-api-key`) | For secure internal requests. |
| `AZURE_FOUNDRY_KEY` | **Key Vault** (`azure-foundry-key`) | API key for Azure AI Foundry. |
| `AZURE_FOUNDRY_ENDPOINT` | **Key Vault** (`azure-foundry-endpoint`) | URL endpoint for the AI Foundry model. |
| `AZURE_STORAGE_CONNECTION_STRING` | **Key Vault** (`azure-storage-connection-string`) | Secure connection string to upload reports to Azure Blob. |
| `AZURE_STORAGE_ACCOUNT_NAME` | **ConfigMap** | Name of the storage account. |
| `AZURE_STORAGE_CONTAINER` | **ConfigMap** | Blob container name (default: `flowforge-reports`). |
| `AZURE_STORAGE_USE_MANAGED_IDENTITY`| **ConfigMap** | `false` (forces fallback to connection string). |
| `REDIS_URL` | **Key Vault** (`redis-url`) | Connection for message queueing (Consumer Group). |
| `STREAM_CONSUMER_GROUP` | **Helm values / Hardcoded** | Analytics worker group for Redis streams. |

---

## 6. Notification Worker (`notification-worker`)

**Purpose**: Background worker consuming Redis streams to send SMTP emails.

| Environment Variable | Source / Fetch Location | Description |
| :--- | :--- | :--- |
| `SMTP_PASSWORD` | **Key Vault** (`smtp-password`) | Authentication password for SMTP. (Required) |
| `SMTP_HOST`, `SMTP_USERNAME` | **ConfigMap** / **Key Vault** | Connection details for the email server. |
| `REDIS_URL` | **Key Vault** (`redis-url`) | Redis connection string to listen to the `audit_log` stream. |
| `FRONTEND_URL` | **ConfigMap** (`FRONTEND_URL`) | Base domain URL to embed hyperlinks inside emails. |

---

## 7. Frontend (`frontend` - Next.js)

**Purpose**: The user-facing web application.

*Note: Frontend variables are predominantly consumed at **build-time** by the Dockerfile (via `--build-arg`), fetched via `yq` in GitHub workflows from `Helm/values-dev.yaml`. The `GATEWAY_URL` is fetched at container runtime.*

| Environment Variable | Source / Fetch Location | Description |
| :--- | :--- | :--- |
| `GATEWAY_URL` | **ConfigMap** (`flowforge-config`) | Internal DNS routing (e.g., `http://gateway:8000`) for the Next.js API rewrites in Docker container. |
| `NEXT_PUBLIC_ENTRA_CLIENT_ID` | **GitHub Workflow / values-dev.yaml** | Azure AD Client ID exposed to the browser. |
| `NEXT_PUBLIC_ENTRA_TENANT_ID` | **GitHub Workflow / values-dev.yaml** | Azure AD Tenant ID exposed to the browser. |
| `NEXT_PUBLIC_ENTRA_REDIRECT_URI` | **GitHub Workflow / values-dev.yaml** | Redirect URI registered in Entra for OAuth flows. |
| `NEXT_PUBLIC_API_URL` | **GitHub Workflow / values-dev.yaml** | The public URL of the backend API. |
| `NEXT_PUBLIC_MOCK_MODE` | **Hardcoded / GitHub Workflow** | If `true`, the UI uses mock data instead of real API calls. |

---

### Understanding the Key Vault Fetch Mechanism (`keyvault.py`)

All backend Python services (Auth, Gateway, Project, Task, Analysis, Notification) use a common `keyvault.py` file which runs upon boot. 

**Here is the exact fetch flow:**
1. The container mounts the `flowforge-config` ConfigMap which provides the `AZURE_KEYVAULT_URL`.
2. The Python application starts and checks if `AZURE_KEYVAULT_URL` exists.
3. It authenticates with Azure using `DefaultAzureCredential` (which uses the AKS Managed Identity `azure.workload.identity`).
4. It iterates over the secrets in the Key Vault. It transforms the Key Vault secret name format (e.g., `internal-api-key`) into the Python environment variable format (e.g., `INTERNAL_API_KEY`) and forcefully injects it into the running application's environment.
5. If there is a collision (e.g. `SMTP_USERNAME` is defined in both ConfigMap and Key Vault), the Key Vault secret will take precedence and override the ConfigMap value within the application context.
