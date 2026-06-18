# FlowForge GitOps & AI Auto-PM — Complete Implementation Blueprint

> **Document Version:** 2.0 — Full Implementation Specification
> **Last Updated:** 2026-06-18
> **Scope:** Everything needed to implement the Self-Hosted GitOps integration, AI Auto-PM reports, and GitHub OAuth from scratch — infrastructure through UI.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current Codebase Analysis & Gap Assessment](#2-current-codebase-analysis--gap-assessment)
3. [Terraform Infrastructure Changes](#3-terraform-infrastructure-changes)
4. [Helm Chart Changes](#4-helm-chart-changes)
5. [New Service: integration-service](#5-new-service-integration-service)
6. [Backend Service Modifications](#6-backend-service-modifications)
7. [Frontend Changes](#7-frontend-changes)
8. [Database Schema Changes](#8-database-schema-changes)
9. [GitHub Workflows (Reusable .github Repo)](#9-github-workflows-reusable-github-repo)
10. [Secrets & Configuration Matrix](#10-secrets--configuration-matrix)
11. [Deployment Order & Verification](#11-deployment-order--verification)
12. [Terraform Issues Found & Fixes](#12-terraform-issues-found--fixes)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Azure Cloud (AKS)                            │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │ Frontend │──│   Gateway    │──│ auth-service   │  │ Key Vault │ │
│  │ (Next.js)│  │ (FastAPI)    │  │ (FastAPI)      │  │ (Secrets) │ │
│  └──────────┘  │              │  │ +GitHub OAuth  │  └───────────┘ │
│                │              │  └───────────────┘                  │
│                │              │                                     │
│                │              │──│ project-service│                  │
│                │              │  │ +GitHub Init   │                  │
│                │              │                                     │
│                │              │──│ task-service   │                  │
│                │              │  │ +Merge Verify  │                  │
│                │              │                                     │
│                │              │──│ integration-   │──▶ GitHub API   │
│                │              │  │ service (NEW)  │                  │
│                │              │                                     │
│                │              │──│ analysis-      │──▶ Azure AI     │
│                │              │  │ service        │──▶ Blob Storage │
│                │              │  │ +AI Reports    │                  │
│                │              │                                     │
│                │              │──│ notification-  │──▶ SMTP/Redis   │
│                │              │  │ worker         │                  │
│                └──────────────┘                                     │
│                                                                     │
│  ┌──────────────────────────────────┐                               │
│  │ ARC (Actions Runner Controller)  │──▶ GitHub (poll for jobs)    │
│  │ Uses CSI Driver for GH App Key  │                               │
│  └──────────────────────────────────┘                               │
│                                                                     │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────┐               │
│  │  PostgreSQL   │  │   Redis    │  │ Blob Storage │               │
│  │  (4 DBs)      │  │ Enterprise │  │ (AI Reports) │               │
│  └──────────────┘  └────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

### New Components Being Added
| Component | Type | Purpose |
|-----------|------|---------|
| `integration-service` | New microservice | All GitHub API interactions (repos, branches, PRs, teams) |
| ARC (Actions Runner Controller) | Helm chart addon | Self-hosted GitHub Actions runners inside AKS |
| CSI Secrets Store Driver | AKS addon | Mounts Key Vault secrets as K8s secrets for ARC |
| `ai-incident-reports` | Blob container | Stores AI-generated JSON reports |
| GitHub OAuth | Auth-service addition | Links member accounts to GitHub usernames |
| Manager Reports page | Frontend page | View AI incident reports per completed task |
| GitHub onboarding screen | Frontend page | Forces members to link GitHub on first login |

---

## 2. Current Codebase Analysis & Gap Assessment

### What Already Exists & Works

| Component | Status | Notes |
|-----------|--------|-------|
| Hub-Spoke network (Terraform) | ✅ Working | Hub VNet, Spoke VNet, peering, NSGs, private DNS zones |
| AKS cluster (Terraform) | ✅ Working | Private cluster, OIDC, workload identity, AGIC, auto-scaling |
| Key Vault (Terraform) | ✅ Working | RBAC-based, private endpoint, AKS identity has Secrets User role |
| Storage Account (Terraform) | ⚠️ Partial | Has `app-data` container, but missing `ai-incident-reports` container |
| PostgreSQL + Redis (Terraform) | ✅ Working | Flexible server, managed Redis, private endpoints |
| Firewall (Terraform) | ⚠️ Prod only | Dev skips firewall. Prod has AKS rules but **missing GitHub/GHCR FQDNs for ARC** |
| App Gateway + AGIC (Terraform) | ✅ Working | Ingress via AGIC |
| Helm umbrella chart | ✅ Working | 7 subcharts deployed via ArgoCD |
| Workload Identity | ✅ Working | Federated credentials for all 7 services, service accounts annotated |
| Gateway routing | ⚠️ Partial | Routes `/api/auth`, `/api/projects`, `/api/tasks`, `/api/analytics`, `/api/ai` — but **no `/api/integration` route** |
| auth-service | ✅ Working | Entra ID login, JWT, invite flow, user CRUD — **missing GitHub OAuth** |
| project-service | ✅ Working | CRUD projects, members — **no GitHub repo creation** |
| task-service | ✅ Working | CRUD tasks, approval flow — **no merge verification guard** |
| analysis-service | ⚠️ Partial | Has AI routes, analytics, reports — **needs AI incident report generation on task completion** |
| notification-worker | ✅ Working | Redis stream consumer for email notifications |
| Frontend | ⚠️ Partial | Dashboard, manager pages, kanban — **missing GitHub onboarding, Reports page** |
| CI/CD Workflows | ✅ Working | Reusable CI, per-service triggers, prod release, terraform workflows |
| ArgoCD | ✅ Working | Auto-sync from Cloud-Track-dev / Cloud-Track-prod branches |
| initdb.sql | ✅ Working | Creates 4 databases with all current schemas |

### What's Missing (Gap List)

| # | Gap | Component | Priority |
|---|-----|-----------|----------|
| G1 | `integration-service` doesn't exist | New service | **P0** |
| G2 | No GitHub OAuth in auth-service | auth-service | **P0** |
| G3 | No `github_username` field on User model | auth-service DB | **P0** |
| G4 | Gateway has no `/api/integration` route | gateway | **P0** |
| G5 | No merge verification guard in task-service | task-service | **P0** |
| G6 | No AI incident report generation on task completion | analysis-service | **P1** |
| G7 | No `ai-incident-reports` blob container in Terraform | storage module | **P1** |
| G8 | No ARC Helm chart or Terraform config | Helm + infra | **P1** |
| G9 | Firewall missing GitHub FQDNs for ARC | Terraform firewall | **P1** |
| G10 | No CSI Secrets Store Driver on AKS | Terraform AKS module | **P1** |
| G11 | `integration-service` missing from federated identity list | Terraform env | **P0** |
| G12 | No Helm subchart for integration-service | Helm | **P0** |
| G13 | Frontend missing GitHub onboarding screen | Frontend | **P1** |
| G14 | Frontend missing Manager Reports page | Frontend | **P1** |
| G15 | initdb.sql missing `integration_db` | Database init | **P0** |
| G16 | 3-day stale PR CRON job in integration-service | integration-service | **P2** |
| G17 | PR webhook internal route | integration-service | **P1** |
| G18 | Values-dev.yaml has **prod** Key Vault names | Helm values | **BUG** |

---

## 3. Terraform Infrastructure Changes

### 3.1 Storage Module — Add `ai-incident-reports` Container

**File:** `terraform/modules/storage/main.tf`

Add after the existing `app_data` container:

```hcl
resource "azurerm_storage_container" "ai_reports" {
  name                  = "ai-incident-reports"
  storage_account_id    = azurerm_storage_account.sa.id
  container_access_type = "private"
}
```

**File:** `terraform/modules/storage/outputs.tf` — Add:

```hcl
output "ai_reports_container_name" {
  value = azurerm_storage_container.ai_reports.name
}
```

### 3.2 AKS Module — Enable CSI Secrets Store Driver

**File:** `terraform/modules/aks/main.tf`

Add inside the `azurerm_kubernetes_cluster.aks` resource block (after `ingress_application_gateway`):

```hcl
key_vault_secrets_provider {
  secret_rotation_enabled  = true
  secret_rotation_interval = "5m"
}
```

This enables the Azure Key Vault Provider for Secrets Store CSI Driver natively via AKS addon. No separate Helm chart needed.

### 3.3 Firewall Module — Add GitHub/GHCR FQDNs for ARC

The firewall module already accepts `aks_allowed_fqdns` as a variable. The fix is in the **prod tfvars** to ensure GitHub domains are included.

**File:** `terraform/env/prod/terraform.tfvars`

The existing `aks_allowed_fqdns` already includes `github.com`, `api.github.com`, `*.ghcr.io`, `ghcr.io`. ✅ Already correct.

However, for completeness, ensure these are present (they are):
- `github.com`
- `api.github.com`
- `*.ghcr.io` / `ghcr.io`
- `*.githubusercontent.com`

### 3.4 Federated Identity — Add `integration-service`

**File:** `terraform/env/dev/main.tf` — Line 168:

```hcl
# CHANGE FROM:
locals {
  microservices = ["frontend", "gateway", "auth-service", "project-service", "task-service", "analysis-service", "notification-worker"]
}

# CHANGE TO:
locals {
  microservices = ["frontend", "gateway", "auth-service", "project-service", "task-service", "analysis-service", "notification-worker", "integration-service"]
}
```

**Same change in:** `terraform/env/prod/main.tf` — Line 218.

### 3.5 Dev Environment — No Firewall (Acceptable)

Dev explicitly omits the firewall module (line 53 comment: "Firewall and VPN Gateway are explicitly omitted in Dev"). This is **fine for a training project** — dev uses `loadBalancer` outbound and prod uses `userDefinedRouting` through the firewall.

---

## 4. Helm Chart Changes

### 4.1 Add `integration-service` Subchart

**Create directory:** `Helm/charts/integration-service/`

**File: `Helm/charts/integration-service/Chart.yaml`**
```yaml
apiVersion: v2
name: integration-service
description: FlowForge GitHub Integration Service
type: application
version: 0.1.0
appVersion: "1.0.0"
```

**File: `Helm/charts/integration-service/values.yaml`**
```yaml
replicaCount: 1

image:
  repository: ghcr.io/noel-mathews-org/flowforge/integration-service
  tag: latest
  pullPolicy: IfNotPresent

service:
  port: 8005

resources:
  requests:
    cpu: 15m
    memory: 64Mi

hpa:
  minReplicas: 1
  maxReplicas: 4
  targetCPUUtilizationPercentage: 70
```

**File: `Helm/charts/integration-service/templates/deployment.yaml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-{{ .Chart.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}-{{ .Chart.Name }}
  template:
    metadata:
      labels:
        tier: backend
        app: {{ .Release.Name }}-{{ .Chart.Name }}
    spec:
      serviceAccountName: {{ .Release.Name }}-{{ .Chart.Name }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.port }}
          envFrom:
            - configMapRef:
                name: flowforge-config
          env:
            - name: APP_PORT
              value: "8005"
          resources:
            requests:
              cpu: {{ .Values.resources.requests.cpu }}
              memory: {{ .Values.resources.requests.memory }}
          livenessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.port }}
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: {{ .Values.service.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
```

**File: `Helm/charts/integration-service/templates/service.yaml`**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Chart.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  selector:
    app: {{ .Release.Name }}-{{ .Chart.Name }}
  ports:
    - port: 80
      targetPort: {{ .Values.service.port }}
```

**File: `Helm/charts/integration-service/templates/serviceaccount.yaml`**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Release.Name }}-{{ .Chart.Name }}
  namespace: {{ .Release.Namespace }}
  annotations:
    azure.workload.identity/use: "true"
    {{- if .Values.global.azure.managedIdentityClientId }}
    azure.workload.identity/client-id: {{ .Values.global.azure.managedIdentityClientId | quote }}
    {{- end }}
automountServiceAccountToken: false
```

**File: `Helm/charts/integration-service/templates/hpa.yaml`**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ .Release.Name }}-{{ .Chart.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ .Release.Name }}-{{ .Chart.Name }}
  minReplicas: {{ .Values.hpa.minReplicas }}
  maxReplicas: {{ .Values.hpa.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.hpa.targetCPUUtilizationPercentage }}
```

### 4.2 Update Parent Chart.yaml

**File:** `Helm/Chart.yaml` — Add dependency:

```yaml
  - name: integration-service
    version: 0.1.0
    repository: "file://./charts/integration-service"
    condition: integration-service.enabled
```

### 4.3 Update Global ConfigMap

**File:** `Helm/templates/global-config.yaml` — Add:

```yaml
  INTEGRATION_SERVICE_URL: "http://integration-service.{{ .Release.Namespace }}.svc.cluster.local:80"
```

### 4.4 Update Values Files

**File:** `Helm/values-dev.yaml` — Add:

```yaml
integration-service:
  enabled: true
  image:
    tag: 4d9670e
```

**File:** `Helm/values-prod.yaml` — Add:

```yaml
integration-service:
  enabled: true
  image:
    tag: v1.1.0
```

### 4.5 FIX BUG: values-dev.yaml Has Prod Key Vault Names

**Current (WRONG):**
```yaml
# values-dev.yaml
global:
  azure:
    keyvaultName: "kv-prod-ff-48x9"        # ← PROD name in DEV!
    keyvaultUrl: "https://kv-prod-ff-48x9.vault.azure.net/"
  storage:
    accountName: "stffprod48x9"             # ← PROD name in DEV!
```

**Fix:** Replace with dev values from `terraform/env/dev/terraform.tfvars`:
```yaml
# values-dev.yaml
global:
  azure:
    keyvaultName: "kv-dev-ff-a1b2"
    keyvaultUrl: "https://kv-dev-ff-a1b2.vault.azure.net/"
  storage:
    accountName: "stffdeva1b2"
```

### 4.6 ARC Deployment (Actions Runner Controller)

ARC is deployed as a **separate Helm release** (not part of the FlowForge umbrella chart) because it runs in its own namespace.

**New file:** `infra/infrastructure/arc-runner-scaleset.yaml`

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: arc-systems
  namespace: argocd
spec:
  project: default
  source:
    repoURL: oci://ghcr.io/actions/actions-runner-controller-charts
    chart: gha-runner-scale-set-controller
    targetRevision: 0.9.3
    helm:
      values: |
        replicaCount: 1
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: arc-systems
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: arc-runner-set
  namespace: argocd
spec:
  project: default
  source:
    repoURL: oci://ghcr.io/actions/actions-runner-controller-charts
    chart: gha-runner-scale-set
    targetRevision: 0.9.3
    helm:
      values: |
        githubConfigUrl: "https://github.com/Noel-Mathews-Org"
        githubConfigSecret:
          github_app_id: ""
          github_app_installation_id: ""
          github_app_private_key: ""
        runnerScaleSetName: "my-flowforge-scale-set"
        maxRunners: 3
        minRunners: 0
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: arc-runners
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

> **Note:** The GitHub App credentials will be stored in Key Vault and injected via CSI driver SecretProviderClass or directly as K8s secrets created from Key Vault. For a training project, you can also manually create the K8s secret from Key Vault values.

---

## 5. New Service: `integration-service`

### 5.1 Service Structure

```
integration-service/
├── Dockerfile
├── requirements.txt
├── main.py
├── config.py
├── database.py
├── keyvault.py          # Copy from existing services
├── models.py
├── schemas.py
├── rbac.py
├── routes/
│   ├── __init__.py
│   ├── projects.py      # POST /integration/project/init, members CRUD
│   ├── tasks.py         # POST /integration/task/branch, GET verify-merge
│   └── webhooks.py      # POST /integration/internal/pr-webhook
├── services/
│   ├── __init__.py
│   └── github_service.py  # All GitHub API calls via PyGithub
├── workers/
│   ├── __init__.py
│   └── stale_pr_cron.py   # 3-day PR timeout CRON
└── sonar-project.properties
```

### 5.2 Dependencies (requirements.txt)

```
fastapi==0.115.6
uvicorn==0.34.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
PyGithub==2.5.0
cryptography>=43.0.0
azure-identity==1.19.0
azure-keyvault-secrets==4.9.0
redis[hiredis]==5.2.1
httpx==0.28.1
pydantic==2.10.4
```

### 5.3 Database Model (models.py)

```python
import uuid, enum
from datetime import datetime
from sqlalchemy import DateTime, String, func, Enum
from sqlalchemy.dialects.postgresql import UUID, ENUM as pgEnum
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class PRStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    MERGED = "MERGED"

class GitHubRepo(Base):
    __tablename__ = "github_repos"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    org_name: Mapped[str] = mapped_column(String(255), nullable=False)
    repo_name: Mapped[str] = mapped_column(String(255), nullable=False)
    repo_full_name: Mapped[str] = mapped_column(String(512), nullable=False)
    team_slug: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

class TaskBranch(Base):
    __tablename__ = "task_branches"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    branch_name: Mapped[str] = mapped_column(String(255), nullable=False)
    pr_number: Mapped[int | None] = mapped_column(nullable=True)
    pr_status: Mapped[str] = mapped_column(
        pgEnum("OPEN", "CLOSED", "MERGED", name="pr_status"),
        nullable=False, default="OPEN"
    )
    assignee_github_username: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
```

### 5.4 API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/integration/project/init` | Manager/Admin | Creates GitHub repo, team, adds reviewer, sets branch protection |
| `POST` | `/integration/project/{id}/members` | Manager/Admin | Adds GitHub collaborator to repo |
| `DELETE` | `/integration/project/{id}/members/{user_id}` | Manager/Admin | Removes collaborator from repo |
| `POST` | `/integration/task/branch` | Manager/Member | Creates feature branch off `main` for a task |
| `GET` | `/integration/task/{task_id}/verify-merge` | Internal/Any | Returns `{merged: true/false}` — checks if task PR is merged |
| `POST` | `/integration/internal/pr-webhook` | Internal (ARC) | Updates PR status from GitHub Actions workflow |
| `GET` | `/health` | Public | Health check |

### 5.5 GitHub Service (`services/github_service.py`)

Uses **PyGithub** library with GitHub App authentication:
- Fetches the GitHub App private key from Azure Key Vault at startup
- Generates installation tokens for API calls
- Functions: `create_repo()`, `create_team()`, `add_collaborator()`, `remove_collaborator()`, `create_branch()`, `set_branch_protection()`, `check_pr_merged()`, `close_stale_prs()`

### 5.6 Stale PR CRON Worker

```python
# workers/stale_pr_cron.py
# Runs every hour via asyncio scheduler
# Queries GitHub API for all open PRs across managed repos
# If PR.updated_at > 72 hours ago → close PR, post comment, notify via Redis stream
```

### 5.7 Docker Configuration

**File: `integration-service/Dockerfile`**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8005
USER 1001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8005"]
```

### 5.8 Docker Compose Addition

**File:** `docker-compose.yml` — Add:

```yaml
  integration-service:
    build: ./integration-service
    ports:
      - "8005:8005"
    depends_on: []
    environment:
      - AZURE_KEYVAULT_URL=${AZURE_KEYVAULT_URL:-}
      - GITHUB_APP_ID=${GITHUB_APP_ID:-}
      - GITHUB_APP_INSTALLATION_ID=${GITHUB_APP_INSTALLATION_ID:-}
      - GITHUB_ORG_NAME=${GITHUB_ORG_NAME:-Noel-Mathews-Org}
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8005/health')"]
      interval: 15s
      timeout: 5s
      retries: 5
```

---

## 6. Backend Service Modifications

### 6.1 Gateway — Add Integration Route

**File:** `gateway/proxy.py` — Line 10, add to routes dict:

```python
routes = {
    "/api/auth": settings.auth_service_url,
    "/api/projects": settings.project_service_url,
    "/api/tasks": settings.task_service_url,
    "/api/analytics": settings.analytics_service_url,
    "/api/ai": settings.analytics_service_url,
    "/api/integration": settings.integration_service_url,   # ← NEW
}
```

**File:** `gateway/config.py` — Add to Settings dataclass:

```python
integration_service_url: str
```

And in `get_settings()`:

```python
integration_service_url=_get_env("INTEGRATION_SERVICE_URL", "http://integration-service:8005"),
```

**File:** `gateway/main.py` — Add to `PUBLIC_ROUTES`:

```python
("POST", "/api/integration/internal/pr-webhook"),  # ARC webhook (internal)
```

### 6.2 Auth-Service — Add GitHub OAuth

#### 6.2.1 User Model Change

**File:** `auth-service/models.py` — Add field to User model:

```python
github_username: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
github_linked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

#### 6.2.2 New Routes

**File:** `auth-service/routes/auth.py` — Add:

```python
@router.get("/auth/github/login")
async def github_oauth_login(request: Request):
    """Redirects to GitHub OAuth authorize URL"""
    # Build GitHub OAuth URL with client_id, redirect_uri, scope=read:user
    pass

@router.get("/auth/github/callback")
async def github_oauth_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Handles GitHub OAuth callback, stores github_username on user"""
    # Exchange code for token, fetch /user, save github_username
    pass
```

#### 6.2.3 JWT Token Change

The JWT token should include `github_username` (if linked) so the frontend knows if onboarding is needed:

**File:** `auth-service/services/jwt_service.py` — Add to token payload:

```python
"github_username": user.github_username,  # None if not linked
```

#### 6.2.4 New Secrets Needed

| Secret | Source | Storage |
|--------|--------|---------|
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App | Key Vault |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App | Key Vault |

### 6.3 Task-Service — Add Merge Verification Guard

**File:** `task-service/routes/tasks.py` — Modify the PATCH endpoint:

When `status` is being changed to `DONE`:

```python
# Before allowing status change to DONE:
# 1. Call integration-service: GET /integration/task/{task_id}/verify-merge
# 2. If response.merged == False → raise HTTPException(400, "PR not merged")
# 3. If merged == True → proceed with status update
# 4. After saving → emit Redis event to analysis-service for AI report generation
```

**File:** `task-service/config.py` — Add:

```python
INTEGRATION_SERVICE_URL: str = os.getenv("INTEGRATION_SERVICE_URL", "http://integration-service:8005")
```

### 6.4 Analysis-Service — Add AI Incident Report Generation

**File:** `analysis-service/routes/reports.py` — Add/modify:

```python
@router.post("/ai/generate-incident-report")
async def generate_incident_report(payload: IncidentReportRequest):
    """
    Internal endpoint triggered after successful task completion.
    1. Fetch PR diff from GitHub (via integration-service or directly)
    2. Send diff + task metadata to Azure AI Foundry
    3. Generate structured JSON report
    4. Save report to Azure Blob Storage (ai-incident-reports container)
    5. Emit email notification event
    """
    pass
```

The report JSON structure:
```json
{
  "task_id": "uuid",
  "pr_link": "https://github.com/org/repo/pull/123",
  "time_to_complete_hours": 12.5,
  "estimated_hours": 8.0,
  "lines_changed": { "additions": 150, "deletions": 30 },
  "reviewer": { "username": "reviewer1", "approved_at": "2026-06-18T10:00:00Z" },
  "ai_summary": "This PR implements feature X by modifying...",
  "security_flags": ["hardcoded-secret-detected", "sql-injection-risk"],
  "generated_at": "2026-06-18T10:30:00Z"
}
```

---

## 7. Frontend Changes

### 7.1 GitHub Onboarding Screen (Members Only)

**New file:** `frontend/app/onboarding/page.tsx`

**Logic:**
- After login, if `jwt.role === "member"` AND `jwt.github_username === null` → redirect to `/onboarding`
- Page shows "Link Your GitHub Account" with OAuth button
- Button calls `GET /api/auth/github/login` → redirects to GitHub → callback saves username
- After linking, user can proceed to normal dashboard

**Changes to existing files:**
- `frontend/providers/` — Add check in auth provider for `github_username` null
- `frontend/components/layout/` — Add redirect logic in sidebar/layout wrapper

### 7.2 Manager Reports Page

**New file:** `frontend/app/manager/reports/page.tsx`

**UI Components:**
- Table listing all completed tasks (from task-service)
- Columns: Task name, PR Link, Time to Complete vs Estimate, LOC Changed, Reviewer, AI Summary, Security Flags
- Click a row → fetch report from `/api/analytics/reports/{task_id}` → display in modal/drawer
- Report is fetched from Blob Storage via analysis-service

**Sidebar change:**
- Add "Reports" nav item to the manager sidebar in `frontend/components/manager/`

### 7.3 Task Completion UI Feedback

**File:** `frontend/components/kanban/` (or wherever task status change is triggered)

**Changes:**
- When user clicks "Mark as Done" → show loading state
- If API returns 400 (PR not merged) → show error toast: *"Task cannot be completed. Please ensure your PR is approved and merged in GitHub first."*
- If success → show success toast

### 7.4 Project Creation — GitHub Repo Integration

**Modify:** `frontend/app/manager/projects/` (project creation form)

**Changes:**
- Add optional field: "Reviewer GitHub Username" to project creation form
- On create, frontend calls existing project-service endpoint
- project-service then calls integration-service to init GitHub repo

---

## 8. Database Schema Changes

### 8.1 New Database: `integration_db`

**Add to `infra/initdb.sql`:**

```sql
CREATE DATABASE integration_db;

\c integration_db

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pr_status') THEN
        CREATE TYPE pr_status AS ENUM ('OPEN', 'CLOSED', 'MERGED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS github_repos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE,
    org_name VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    repo_full_name VARCHAR(512) NOT NULL,
    team_slug VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL UNIQUE,
    project_id UUID NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    pr_number INTEGER,
    pr_status pr_status NOT NULL DEFAULT 'OPEN',
    assignee_github_username VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_repos_project_id ON github_repos(project_id);
CREATE INDEX IF NOT EXISTS idx_task_branches_task_id ON task_branches(task_id);
CREATE INDEX IF NOT EXISTS idx_task_branches_project_id ON task_branches(project_id);
```

### 8.2 Auth DB — Add GitHub Fields

**Add to `infra/initdb.sql` in auth_db section:**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_linked_at TIMESTAMP WITH TIME ZONE;
```

---

## 9. GitHub Workflows (Reusable `.github` Repo)

### 9.1 Organization-Level `.github` Repository

Create a repository named `.github` in the `Noel-Mathews-Org` organization with these reusable workflows:

**File: `.github/workflows/pr-check.yml`**
```yaml
name: PR Check
on:
  workflow_call:
jobs:
  check:
    runs-on: my-flowforge-scale-set
    steps:
      - uses: actions/checkout@v4
      - name: Lint & Security Scan
        run: echo "Running linting and security scans..."
      - name: Notify FlowForge (pending/failed)
        if: always()
        run: |
          STATUS=${{ job.status == 'success' && 'pending' || 'failed' }}
          curl -s -X POST http://gateway.flowforge.svc.cluster.local:80/integration/internal/pr-webhook \
            -H "Content-Type: application/json" \
            -d "{\"pr_number\": ${{ github.event.pull_request.number }}, \"status\": \"$STATUS\", \"repo\": \"${{ github.repository }}\"}"
```

**File: `.github/workflows/pr-merged.yml`**
```yaml
name: PR Merged
on:
  workflow_call:
jobs:
  cleanup:
    runs-on: my-flowforge-scale-set
    if: github.event.pull_request.merged == true
    steps:
      - uses: actions/checkout@v4
      - name: Delete Feature Branch
        run: git push origin --delete ${{ github.head_ref }} || true
      - name: Notify FlowForge (merged)
        run: |
          curl -s -X POST http://gateway.flowforge.svc.cluster.local:80/integration/internal/pr-webhook \
            -H "Content-Type: application/json" \
            -d "{\"pr_number\": ${{ github.event.pull_request.number }}, \"status\": \"merged\", \"repo\": \"${{ github.repository }}\"}"
```

> **Note:** The ARC runners run inside the AKS cluster, so they can reach `gateway.flowforge.svc.cluster.local` directly via ClusterIP.

### 9.2 CI Workflow for integration-service

**New file:** `.github/workflows/ci-integration-service.yml`

```yaml
name: CI – integration-service
on:
  push:
    branches: [Cloud-Track-dev, Cloud-Track-prod]
    paths: ['integration-service/**']
  pull_request:
    branches: [Cloud-Track-dev]
    paths: ['integration-service/**']

jobs:
  build:
    uses: ./.github/workflows/_ci-reusable.yml
    with:
      service_name: integration-service
      service_path: integration-service
      service_port: "8005"
    secrets: inherit
```

---

## 10. Secrets & Configuration Matrix

### 10.1 Key Vault Secrets (to be added)

| Secret Name | Value | Used By |
|-------------|-------|---------|
| `github-app-private-key` | PEM private key of the GitHub App | integration-service, ARC |
| `github-app-id` | GitHub App ID | integration-service, ARC |
| `github-app-installation-id` | Installation ID for the org | integration-service, ARC |
| `github-oauth-client-id` | OAuth App Client ID (for user linking) | auth-service |
| `github-oauth-client-secret` | OAuth App Client Secret | auth-service |
| `azure-foundry-key` | Azure AI Foundry API key | analysis-service |

> These secrets are fetched at runtime by each service via the `keyvault.py` module that already exists in every service.

### 10.2 ConfigMap Additions

**File:** `Helm/templates/global-config.yaml` — Full additions:

```yaml
  INTEGRATION_SERVICE_URL: "http://integration-service.{{ .Release.Namespace }}.svc.cluster.local:80"
  GITHUB_ORG_NAME: "Noel-Mathews-Org"
```

### 10.3 Environment Variables per Service

| Variable | Service | Source |
|----------|---------|--------|
| `INTEGRATION_SERVICE_URL` | gateway, task-service | ConfigMap |
| `GITHUB_APP_PRIVATE_KEY` | integration-service | Key Vault |
| `GITHUB_APP_ID` | integration-service | Key Vault |
| `GITHUB_APP_INSTALLATION_ID` | integration-service | Key Vault |
| `GITHUB_OAUTH_CLIENT_ID` | auth-service | Key Vault |
| `GITHUB_OAUTH_CLIENT_SECRET` | auth-service | Key Vault |
| `GITHUB_ORG_NAME` | integration-service | ConfigMap |

---

## 11. Deployment Order & Verification

### Phase 1: Infrastructure (Terraform)

```
1. Apply storage module change (add ai-incident-reports container)
2. Apply AKS module change (enable CSI Secrets Store Driver)
3. Apply federated identity change (add integration-service)
4. Upload new secrets to Key Vault:
   - github-app-private-key
   - github-app-id
   - github-app-installation-id
   - github-oauth-client-id
   - github-oauth-client-secret
   - azure-foundry-key (if not already present)
```

**Verification:**
```bash
# Check CSI driver is enabled
az aks show -g rg-dev-app -n aks-dev-a1b2 --query "addonProfiles.azureKeyvaultSecretsProvider"

# Check new container exists
az storage container list --account-name stffdeva1b2 --query "[].name"

# Check federated identity for integration-service
az identity federated-credential list --identity-name mi-flowforge-app-dev --resource-group rg-dev-app
```

### Phase 2: Backend Services

```
1. Create integration-service directory with all files
2. Update auth-service (GitHub OAuth, github_username field)
3. Update gateway (add /api/integration route)
4. Update task-service (merge verification guard)
5. Update analysis-service (AI report generation endpoint)
6. Update docker-compose.yml (add integration-service)
7. Run initdb.sql updates (new integration_db, alter auth_db users)
8. Test locally with docker-compose
```

### Phase 3: Helm & CI/CD

```
1. Create Helm subchart for integration-service
2. Update Chart.yaml dependencies
3. Update values-dev.yaml and values-prod.yaml
4. FIX values-dev.yaml Key Vault names (currently using prod!)
5. Update global-config.yaml
6. Create CI workflow for integration-service
7. Commit to Cloud-Track-dev → ArgoCD auto-syncs
```

### Phase 4: Frontend

```
1. Add GitHub onboarding page (/onboarding)
2. Add auth provider github_username check
3. Add Manager Reports page (/manager/reports)
4. Update task completion UI with error handling
5. Update project creation form (reviewer field)
6. Add sidebar nav item for Reports
```

### Phase 5: ARC Setup

```
1. Create GitHub App in org settings
2. Install GitHub App on the org
3. Store credentials in Key Vault
4. Deploy ARC via ArgoCD (arc-runner-scaleset.yaml)
5. Create .github org repo with reusable workflows
6. Test by creating a project in FlowForge → verify repo created → push code → verify workflow runs on ARC
```

---

## 12. Terraform Issues Found & Fixes

### Issue 1: `purge_protection_enabled = true` Blocks Dev Re-deployments

**File:** `terraform/modules/key_vault/main.tf` — Line 10

```hcl
purge_protection_enabled = true
```

**Problem:** With purge protection, you can't delete and recreate the Key Vault for 7 days (soft-delete retention). This is problematic for dev environments where you might tear down and recreate infrastructure.

**Fix:** Make it conditional:

```hcl
variable "purge_protection_enabled" {
  type    = bool
  default = true
}

# In main.tf:
purge_protection_enabled = var.purge_protection_enabled
```

Set `false` for dev, `true` for prod.

### Issue 2: PostgreSQL Flexible Server Missing VNet Integration

**File:** `terraform/modules/databases/main.tf`

The PostgreSQL server uses a private endpoint but doesn't have `delegated_subnet_id` or `private_dns_zone_id` configured for VNet-integrated deployment. The current approach (private endpoint only) is **valid** but the private endpoint uses `subresource_names = ["postgresqlServer"]` which is for single-server, not flexible server.

**Fix:** For PostgreSQL Flexible Server, the correct private networking approach is either:
- VNet injection (delegated subnet) — **recommended for Flexible Server**
- Or private endpoint with `subresource_names = ["postgresqlServer"]`

Both work, but VNet injection is the recommended approach for Flexible Server. The current config works functionally.

### Issue 3: Security — Hardcoded Passwords in tfvars

**Files:** `terraform/env/dev/terraform.tfvars` and `terraform/env/prod/terraform.tfvars`

```
postgres_admin_password = "P@ssw0rd1234!"
jumpbox_admin_password  = "P@ssw0rdJumpb0x!"
```

**Problem:** Secrets committed to Git.

**Fix for training project:** Acceptable, but mark them with a comment noting they should use `terraform.tfvars` with `.gitignore` or use environment variables / Azure DevOps variable groups in production.

### Issue 4: Backend State Not Configured for Dev

**File:** `terraform/env/dev/providers.tf` — Lines 8-14 are commented out:

```hcl
# backend "azurerm" {
#   resource_group_name  = "rg-terraform-state"
#   ...
# }
```

**Problem:** Dev uses local state. If multiple team members apply, state conflicts will occur.

**Fix:** Uncomment and configure (or use `terraform init -backend-config=...`). For a training project with a single operator, local state is acceptable.

### Issue 5: No ACR (Azure Container Registry) in Terraform

Images are stored in GHCR (`ghcr.io/noel-mathews-org/flowforge/`), not ACR. This is **fine** — the CI workflows push to GHCR and AKS pulls from GHCR. No ACR needed.

### Issue 6: `subscription_id` Commented Out in Provider

**File:** `terraform/env/dev/providers.tf` — Line 27:
```hcl
# subscription_id = var.subscription_id
```

This relies on `az login` context. For training, this is fine. For proper multi-subscription setups, uncomment.

---

## Summary: Complete File Change List

### New Files to Create
| File | Description |
|------|-------------|
| `integration-service/` (entire directory) | New microservice |
| `Helm/charts/integration-service/` (entire subchart) | Helm deployment config |
| `.github/workflows/ci-integration-service.yml` | CI pipeline |
| `infra/infrastructure/arc-runner-scaleset.yaml` | ARC deployment |
| `frontend/app/onboarding/page.tsx` | GitHub linking page |
| `frontend/app/manager/reports/page.tsx` | AI reports page |

### Files to Modify
| File | Change |
|------|--------|
| `terraform/modules/storage/main.tf` | Add `ai-incident-reports` container |
| `terraform/modules/storage/outputs.tf` | Add output |
| `terraform/modules/aks/main.tf` | Enable CSI Secrets Store Driver |
| `terraform/env/dev/main.tf` | Add `integration-service` to microservices list |
| `terraform/env/prod/main.tf` | Add `integration-service` to microservices list |
| `Helm/Chart.yaml` | Add integration-service dependency |
| `Helm/values-dev.yaml` | Fix KV names + add integration-service |
| `Helm/values-prod.yaml` | Add integration-service |
| `Helm/templates/global-config.yaml` | Add INTEGRATION_SERVICE_URL |
| `gateway/proxy.py` | Add `/api/integration` route |
| `gateway/config.py` | Add `integration_service_url` |
| `gateway/main.py` | Add PR webhook to PUBLIC_ROUTES |
| `auth-service/models.py` | Add `github_username`, `github_linked_at` |
| `auth-service/routes/auth.py` | Add GitHub OAuth endpoints |
| `auth-service/services/jwt_service.py` | Add github_username to JWT payload |
| `task-service/routes/tasks.py` | Add merge verification guard |
| `task-service/config.py` | Add INTEGRATION_SERVICE_URL |
| `analysis-service/routes/reports.py` | Add AI incident report generation |
| `docker-compose.yml` | Add integration-service |
| `infra/initdb.sql` | Add integration_db, alter auth_db |
| `frontend/components/layout/` | Add onboarding redirect logic |
| `frontend/components/manager/` | Add Reports nav item |
