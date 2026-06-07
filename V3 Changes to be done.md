# FlowForge — Deployment & Azure Infrastructure Guide

## Part 1: What Was Changed (Code Summary)

### WS1: Latency Graph — Now Real-Time
- [analytics.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/analysis-service/routes/analytics.py) — Replaced `random.randint()` with actual `time.perf_counter()` measurements of `SELECT 1` (DB) and `redis.ping()`. Uses a `deque(maxlen=20)` ring buffer that persists across requests.

### WS2: Metrics Card Math — Hardcoded Trends Removed
- [OverviewCards.tsx](file:///c:/Users/admin/Desktop/Floforge/FlowForge/frontend/components/admin/OverviewCards.tsx) — Removed fake `trend: 8`, `trend: 5`, `trend: 3`. Total Tasks now shows "events today" count. Other cards show no trend (no historical data to compare).

### WS3: AI Service Hardened
- [ai.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/analysis-service/routes/ai.py) — Complete rewrite with:
  - `max_tokens=150`, `temperature=0.3`, `timeout=8.0s`
  - `MAX_PROMPT_CHARS=5000` guard
  - Rate limiting: 50 requests/minute per user
  - System prompt: "Only use supplied data, max 3 sentences, under 100 words"
  - Backend now fetches metrics from DB (never trusts frontend)
  - Persistent `ai_usage_logs` table instead of in-memory list
  - Managed Identity support for Azure AI Foundry
- [models.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/analysis-service/models.py) — Added `AiUsageLog` model
- [initdb.sql](file:///c:/Users/admin/Desktop/Floforge/FlowForge/infra/initdb.sql) — Added `ai_usage_logs` table + indexes

### WS4: Dynamic PDF Reports
- [reports.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/analysis-service/routes/reports.py) — `chart_labels`, `chart_values`, `executive_summary` are now optional. Backend fetches real task status counts when not provided.
- [reports/page.tsx](file:///c:/Users/admin/Desktop/Floforge/FlowForge/frontend/app/org/reports/page.tsx) — Removed hardcoded `chart_values: [12, 5, 20]`

### WS5: Microsoft Entra ID Integration
- [auth-service/config.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/auth-service/config.py) — Added all Entra ID env vars
- [entra_service.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/auth-service/services/entra_service.py) — **NEW** — Token validation, group mapping, Graph API admin ops
- [auth.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/auth-service/routes/auth.py) — Added `POST /auth/login/entra` with JIT provisioning
- [models.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/auth-service/models.py) — `hashed_password` now nullable, added `entra_oid`
- [users.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/auth-service/routes/users.py) — Revoke/activate/role-change now syncs Entra groups
- [auth.ts](file:///c:/Users/admin/Desktop/Floforge/FlowForge/frontend/lib/auth.ts) — Added MSAL + `loginWithEntra()`
- [login/page.tsx](file:///c:/Users/admin/Desktop/Floforge/FlowForge/frontend/app/login/page.tsx) — "Sign in with Microsoft" button + email/password fallback
- [initdb.sql](file:///c:/Users/admin/Desktop/Floforge/FlowForge/infra/initdb.sql) — `hashed_password` nullable, added `entra_oid` column, no seeded users

### WS6: Azure Blob Storage
- [reports.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/analysis-service/routes/reports.py) — Added `_get_blob_service_client()` factory supporting Managed Identity (`DefaultAzureCredential`) and connection string fallback
- [config.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/analysis-service/config.py) — Added `AZURE_STORAGE_*` settings

### WS7: Azure Key Vault
- [keyvault.py](file:///c:/Users/admin/Desktop/Floforge/FlowForge/gateway/keyvault.py) — **NEW** — Shared utility copied to all 3 services. Loads secrets from KV on startup, injects into `os.environ` (env vars take precedence)
- All 3 config files now call `apply_keyvault_secrets()` at import time

### WS8: SSL & Infrastructure
- [nginx.conf](file:///c:/Users/admin/Desktop/Floforge/FlowForge/infra/nginx/nginx.conf) — **NEW** — SSL termination with Let's Encrypt, security headers, WebSocket support
- [env.example](file:///c:/Users/admin/Desktop/Floforge/FlowForge/infra/env.example) — **NEW** — Complete `.env` template
- [docker-compose.yml](file:///c:/Users/admin/Desktop/Floforge/FlowForge/docker-compose.yml) — Added nginx/certbot (behind `ssl` profile), all new env vars

---

## Part 2: Azure Infrastructure Setup

> [!IMPORTANT]
> Complete these steps **in order**. Each step depends on values from the previous one.

---

### Step 1: Create Resource Group

```bash
az group create --name FlowForge-RG --location eastus
```

---

### Step 2: Azure AD App Registration (Entra ID)

```bash
# 1. Create the App Registration
az ad app create \
  --display-name "FlowForge" \
  --web-redirect-uris "https://flowforge.fun/api/auth/callback" "http://localhost:3000/api/auth/callback" \
  --sign-in-audience "AzureADMyOrg"

# 2. Note the Application (client) ID from output → this is ENTRA_CLIENT_ID
# Example: "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 3. Create a Client Secret
az ad app credential reset --id <APP_ID> --append
# Note the "password" → this is ENTRA_CLIENT_SECRET

# 4. Add API Permissions
az ad app permission add --id <APP_ID> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions \
    e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope \
    311a71cc-e848-46a1-bdf8-97ff7156d8e6=Scope \
    62a82d76-70ea-41e2-9197-370581804d09=Role

# 5. Grant admin consent
az ad app permission admin-consent --id <APP_ID>
```

**Where to put the values:**

| Value | Env Var | Where |
|-------|---------|-------|
| Tenant ID | `ENTRA_TENANT_ID` | `.env` root, auth-service `.env`, docker-compose |
| Application (client) ID | `ENTRA_CLIENT_ID` | `.env` root, auth-service `.env` |
| Client Secret | `ENTRA_CLIENT_SECRET` | `.env` root, auth-service `.env` (or Key Vault) |
| Application (client) ID | `NEXT_PUBLIC_ENTRA_CLIENT_ID` | Frontend build arg in docker-compose |
| Tenant ID | `NEXT_PUBLIC_ENTRA_TENANT_ID` | Frontend build arg in docker-compose |

> [!TIP]
> Your Tenant ID is always visible at: Azure Portal → Azure Active Directory → Overview → "Tenant ID"

---

### Step 3: Create Security Groups

```bash
az ad group create --display-name "FlowForge-PlatformAdmin" --mail-nickname "ff-platform-admin"
az ad group create --display-name "FlowForge-OrgOwner" --mail-nickname "ff-org-owner"
az ad group create --display-name "FlowForge-Manager" --mail-nickname "ff-manager"
az ad group create --display-name "FlowForge-Member" --mail-nickname "ff-member"
```

**Get the Group Object IDs:**

```bash
az ad group show --group "FlowForge-PlatformAdmin" --query id -o tsv
az ad group show --group "FlowForge-OrgOwner" --query id -o tsv
az ad group show --group "FlowForge-Manager" --query id -o tsv
az ad group show --group "FlowForge-Member" --query id -o tsv
```

**Where to put the values:**

| Group | Env Var |
|-------|---------|
| FlowForge-PlatformAdmin Object ID | `ENTRA_GROUP_PLATFORM_ADMIN` |
| FlowForge-OrgOwner Object ID | `ENTRA_GROUP_ORG_OWNER` |
| FlowForge-Manager Object ID | `ENTRA_GROUP_MANAGER` |
| FlowForge-Member Object ID | `ENTRA_GROUP_MEMBER` |

**Add yourself to PlatformAdmin group:**

```bash
# Get your user's Object ID
az ad signed-in-user show --query id -o tsv

# Add to platform admin group
az ad group member add --group "FlowForge-PlatformAdmin" --member-id <YOUR_OBJECT_ID>
```

---

### Step 4: Enable Token Group Claims

1. Go to **Azure Portal → Azure AD → App Registrations → FlowForge**
2. Click **Token configuration** in the left menu
3. Click **Add groups claim**
4. Select **Security groups**
5. Under **ID token**, check **Group ID**
6. Under **Access token**, check **Group ID**
7. Click **Add**

---

### Step 5: Azure AI Foundry

You mentioned you already have this set up with `summary-agent` deployment.

**Where to put the values:**

| Value | Env Var |
|-------|---------|
| Endpoint URL | `AZURE_FOUNDRY_ENDPOINT` (e.g., `https://xxx.openai.azure.com`) |
| API Key | `AZURE_FOUNDRY_KEY` |
| Deployment Name | `AZURE_FOUNDRY_DEPLOYMENT` (default: `summary-agent`) |

---

### Step 6: Azure Storage Account (Blob Storage)

```bash
# Create storage account
az storage account create \
  --name flowforgestorage \
  --resource-group FlowForge-RG \
  --location eastus \
  --sku Standard_LRS

# Create container
az storage container create \
  --name flowforge-reports \
  --account-name flowforgestorage

# Get connection string
az storage account show-connection-string --name flowforgestorage -o tsv
```

**Where to put the values:**

| Value | Env Var |
|-------|---------|
| Connection String | `AZURE_STORAGE_CONNECTION_STRING` |
| Account Name | `AZURE_STORAGE_ACCOUNT_NAME` (only needed for Managed Identity mode) |

---

### Step 7: Azure Key Vault

```bash
# Create Key Vault
az keyvault create \
  --name flowforge-kv \
  --resource-group FlowForge-RG \
  --location eastus

# Store secrets
az keyvault secret set --vault-name flowforge-kv --name "jwt-secret" --value "<GENERATE_STRONG_SECRET>"
az keyvault secret set --vault-name flowforge-kv --name "internal-api-key" --value "<GENERATE_STRONG_KEY>"
az keyvault secret set --vault-name flowforge-kv --name "entra-client-secret" --value "<FROM_STEP_2>"
az keyvault secret set --vault-name flowforge-kv --name "azure-foundry-key" --value "<FROM_STEP_5>"
az keyvault secret set --vault-name flowforge-kv --name "smtp-password" --value "<YOUR_SMTP_APP_PASSWORD>"
az keyvault secret set --vault-name flowforge-kv --name "azure-storage-connection-string" --value "<FROM_STEP_6>"
```

> [!CAUTION]
> Once secrets are in Key Vault, **remove them from `.env` files**. Set only `AZURE_KEYVAULT_URL=https://flowforge-kv.vault.azure.net` in `.env` and the services will load secrets from KV automatically.

**Where to put the value:**

| Value | Env Var |
|-------|---------|
| `https://flowforge-kv.vault.azure.net` | `AZURE_KEYVAULT_URL` |

---

### Step 8: DNS Configuration

Point `flowforge.fun` to your Azure VM public IP:

1. Go to your domain registrar (where you bought `flowforge.fun`)
2. Add/update these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<VM_PUBLIC_IP>` | 300 |
| A | `www` | `<VM_PUBLIC_IP>` | 300 |
| CNAME | `www` | `flowforge.fun` | 300 |

**Get your VM's public IP:**
```bash
az vm list-ip-addresses --name <VM_NAME> --resource-group <RG> --query "[0].virtualMachine.network.publicIpAddresses[0].ipAddress" -o tsv
```

> [!NOTE]
> DNS propagation can take up to 48 hours but usually completes in 5–15 minutes. Test with `nslookup flowforge.fun`.

---

### Step 9: SSL Certificate (Let's Encrypt)

**On your Azure VM:**

```bash
# SSH into the VM
ssh azureuser@<VM_PUBLIC_IP>

# Install certbot
sudo apt update && sudo apt install -y certbot

# Get certificate (stop any services on port 80 first)
sudo certbot certonly --standalone -d flowforge.fun -d www.flowforge.fun \
  --agree-tos --email noelmathews123@gmail.com --non-interactive

# Verify
sudo ls /etc/letsencrypt/live/flowforge.fun/
# Should see: fullchain.pem  privkey.pem  chain.pem  cert.pem
```

---

### Step 10: VM Firewall (NSG Rules)

Ensure the VM's Network Security Group allows:

| Priority | Port | Protocol | Source | Purpose |
|----------|------|----------|--------|---------|
| 100 | 80 | TCP | Any | HTTP (redirect to HTTPS) |
| 110 | 443 | TCP | Any | HTTPS |
| 120 | 22 | TCP | Your IP | SSH |

```bash
az network nsg rule create \
  --resource-group <RG> --nsg-name <NSG_NAME> \
  --name AllowHTTP --priority 100 --protocol Tcp \
  --destination-port-ranges 80 --access Allow --direction Inbound

az network nsg rule create \
  --resource-group <RG> --nsg-name <NSG_NAME> \
  --name AllowHTTPS --priority 110 --protocol Tcp \
  --destination-port-ranges 443 --access Allow --direction Inbound
```

---

## Part 3: Deployment Steps (On the VM)

### 3.1 Clone and Configure

```bash
cd /opt
git clone <your-repo-url> FlowForge
cd FlowForge

# Copy the template
cp infra/env.example .env

# Edit .env with all values from steps above
nano .env
```

### 3.2 Set Per-Service .env Files

Each service has its own `.env` file. The key one is `DATABASE_URL`:

```bash
# gateway/.env
echo "REDIS_URL=redis://redis:6379" > gateway/.env

# auth-service/.env
cat > auth-service/.env << 'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/auth_db
REDIS_URL=redis://redis:6379
FRONTEND_URL=https://flowforge.fun
EOF

# project-service/.env
cat > project-service/.env << 'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/project_db
REDIS_URL=redis://redis:6379
AUTH_SERVICE_URL=http://auth-service:8001
EOF

# task-service/.env
cat > task-service/.env << 'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/task_db
REDIS_URL=redis://redis:6379
AUTH_SERVICE_URL=http://auth-service:8001
PROJECT_SERVICE_URL=http://project-service:8002
EOF

# analysis-service/.env
cat > analysis-service/.env << 'EOF'
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/analytics_db
REDIS_URL=redis://redis:6379
AUTH_SERVICE_URL=http://auth-service:8001
PROJECT_SERVICE_URL=http://project-service:8002
TASK_SERVICE_URL=http://task-service:8003
EOF

# notification-worker/.env
cat > notification-worker/.env << 'EOF'
REDIS_URL=redis://redis:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=<your_email>
SMTP_PASSWORD=<your_app_password>
EOF
```

### 3.3 Build and Run

```bash
# Development (no SSL)
docker-compose up --build -d

# Production (with SSL — after certbot is done)
docker-compose --profile ssl up --build -d
```

### 3.4 Verify

```bash
# Check all services are healthy
docker-compose ps

# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8004/health

# Test SSL (after DNS + certbot)
curl https://flowforge.fun/health
```

---

## Part 4: First Login Flow

1. Add yourself to the **FlowForge-PlatformAdmin** security group in Azure AD (Step 3 above)
2. Navigate to `https://flowforge.fun/login`
3. Click **"Sign in with Microsoft"**
4. Microsoft popup → authenticate → consent
5. Backend validates token → checks groups → maps to `platform_admin` role
6. **JIT Provisioning**: User record is auto-created in FlowForge DB
7. You're redirected to the Platform Admin dashboard

> [!IMPORTANT]
> To add more users: Go to **Azure AD → Groups → FlowForge-OrgOwner/Manager/Member → Add members**. When they sign in for the first time, their account is auto-created with the correct role.

---

## Part 5: Future — AKS Migration

When ready to move from Docker Compose (VM) to AKS:

```bash
# 1. Create AKS cluster with AGIC
az aks create \
  --name flowforge-aks \
  --resource-group FlowForge-RG \
  --node-count 2 \
  --enable-addons ingress-appgw \
  --appgw-name flowforge-appgw \
  --appgw-subnet-cidr "10.225.0.0/16" \
  --generate-ssh-keys \
  --enable-managed-identity

# 2. Enable Key Vault CSI Driver
az aks enable-addons --addons azure-keyvault-secrets-provider \
  --name flowforge-aks --resource-group FlowForge-RG

# 3. Grant AKS identity access to Key Vault
AKS_IDENTITY=$(az aks show -n flowforge-aks -g FlowForge-RG \
  --query identityProfile.kubeletidentity.objectId -o tsv)
az keyvault set-policy --name flowforge-kv \
  --object-id $AKS_IDENTITY --secret-permissions get list

# 4. Grant AKS identity access to Blob Storage
az role assignment create \
  --assignee $AKS_IDENTITY \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/FlowForge-RG/providers/Microsoft.Storage/storageAccounts/flowforgestorage

# 5. Grant AKS identity access to AI Foundry
az role assignment create \
  --assignee $AKS_IDENTITY \
  --role "Cognitive Services OpenAI User" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/FlowForge-RG/providers/Microsoft.CognitiveServices/accounts/<AI_RESOURCE>
```

In AKS, set these env vars to use Managed Identity instead of keys:
- `AZURE_STORAGE_USE_MANAGED_IDENTITY=true`
- `AZURE_FOUNDRY_USE_MANAGED_IDENTITY=true`
- Remove `AZURE_FOUNDRY_KEY` and `AZURE_STORAGE_CONNECTION_STRING`

---

## Part 6: Azure Front Door (Production)

```bash
az afd profile create \
  --profile-name flowforge-fd \
  --resource-group FlowForge-RG \
  --sku Standard_AzureFrontDoor

az afd endpoint create \
  --profile-name flowforge-fd \
  --endpoint-name flowforge \
  --resource-group FlowForge-RG

# Add custom domain
az afd custom-domain create \
  --profile-name flowforge-fd \
  --custom-domain-name flowforge-fun \
  --host-name flowforge.fun \
  --resource-group FlowForge-RG \
  --certificate-type ManagedCertificate

# Point DNS CNAME to Front Door endpoint
# flowforge.fun → flowforge-xxxxx.z01.azurefd.net
```

---

## Quick Reference: All Env Vars

| Env Var | Service(s) | Source |
|---------|-----------|--------|
| `JWT_SECRET` | gateway, auth | Generate / Key Vault |
| `INTERNAL_API_KEY` | all backends | Generate / Key Vault |
| `ENTRA_TENANT_ID` | auth, frontend | Azure AD Portal |
| `ENTRA_CLIENT_ID` | auth, frontend | App Registration |
| `ENTRA_CLIENT_SECRET` | auth | App Registration / Key Vault |
| `ENTRA_GROUP_PLATFORM_ADMIN` | auth | Security Group Object ID |
| `ENTRA_GROUP_ORG_OWNER` | auth | Security Group Object ID |
| `ENTRA_GROUP_MANAGER` | auth | Security Group Object ID |
| `ENTRA_GROUP_MEMBER` | auth | Security Group Object ID |
| `AZURE_FOUNDRY_ENDPOINT` | analysis | AI Foundry |
| `AZURE_FOUNDRY_KEY` | analysis | AI Foundry / Key Vault |
| `AZURE_FOUNDRY_DEPLOYMENT` | analysis | `summary-agent` |
| `AZURE_STORAGE_CONNECTION_STRING` | analysis | Storage Account / Key Vault |
| `AZURE_KEYVAULT_URL` | all backends | Key Vault URL |
| `NEXT_PUBLIC_ENTRA_CLIENT_ID` | frontend | Same as `ENTRA_CLIENT_ID` |
| `NEXT_PUBLIC_ENTRA_TENANT_ID` | frontend | Same as `ENTRA_TENANT_ID` |
| `SMTP_HOST` | auth, notification | `smtp.gmail.com` |
| `SMTP_PASSWORD` | auth, notification | Gmail App Password / Key Vault |
