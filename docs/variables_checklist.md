# FlowForge Deployment Checklist & Variables Guide

This document provides a clear separation of where environment variables are stored, how they are loaded, and what exact steps you must take when deploying this infrastructure to a **new Azure environment** (e.g., a new subscription or tenant).

---

## 1. Secrets to Store in Azure Key Vault

These values are highly sensitive. They are fetched dynamically at application runtime by the backend Python services using AKS Managed Identity. 

**You must manually create these exact secret names in your Azure Key Vault:**

### Databases & Caching
*   `database-url` : The PostgreSQL connection string. *(Note: All services now share this single secret)*.
*   `redis-url` : The Azure Managed Redis connection string. *(Required because Redis Enterprise requires access keys).*

### Security & Internal Auth
*   `jwt-secret` : A secure, random string used to sign JWT tokens.
*   `internal-api-key` : A secure, random string used for service-to-service internal communication.
*   `entra-client-secret` : The client secret for your Azure AD (Entra) Application Registration.

### Azure AI Foundry
*   `azure-foundry-key` : API key for your Azure AI Foundry resource.
*   `azure-foundry-endpoint` : Endpoint URL for your Azure AI Foundry resource.

### SMTP / Email Delivery
*   `smtp-username` : The email address used to authenticate with the SMTP server (e.g., `bloodymaryy77@gmail.com`).
*   `smtp-password` : The app password or SMTP password for the above email.

### Entra ID RBAC Groups (Object IDs)
*   `entra-group-platform-admin` : Object ID for Platform Admin group.
*   `entra-group-org-owner` : Object ID for Org Owner group.
*   `entra-group-manager` : Object ID for Manager group.
*   `entra-group-member` : Object ID for Member group.

*(Note: We no longer use `azure-storage-connection-string`. Storage securely uses Managed Identity).*

---

## 2. Variables Configured in Helm (`values-dev.yaml`)

The `Helm/values-dev.yaml` file acts as your central configuration hub for non-sensitive cluster data. Values defined here are injected into the Kubernetes ConfigMap (`flowforge-config`) and read by GitHub Actions.

> **CRITICAL ARCHITECTURE NOTE (The "Dual-Use" Variables):**
> Because Next.js (the Frontend) requires variables at *build time*, the GitHub Actions workflow parses `values-dev.yaml` to bake the Entra Tenant ID and Client ID directly into the frontend image. 
> However, the Backend securely pulls these same values directly from the Azure Key Vault at *runtime*.
> **Therefore, the Entra Tenant ID and Client ID must exist in BOTH the Azure Key Vault (Section 1) AND the `values-dev.yaml` file.**

When deploying to a **new environment**, you must update `Helm/values-dev.yaml`:

```yaml
global:
  domain: your-new-domain.com           # 1. Update Domain
  azure:
    tenantId: "NEW-TENANT-ID"           # 2. Update Azure Tenant ID (Must match Key Vault)
    keyvaultName: "new-kv-name"         # 3. Update Key Vault Name
    keyvaultUrl: "https://new-kv-name.vault.azure.net/" # 4. Update Key Vault URL
  entra:
    clientId: "NEW-CLIENT-ID"           # 5. Update Entra App Client ID (Must match Key Vault)
  storage:
    accountName: "newstorageacct"       # 6. Update Storage Account Name
```

---

## 3. Steps for Deploying in a New Setting

If you are moving to a new Azure Account or recreating the infrastructure from scratch, follow these exact steps:

### Step A: Infrastructure Setup
1. Run Terraform to provision the infrastructure (AKS, Postgres, Redis, Storage, Key Vault).
2. Take note of the newly created Key Vault URL, Storage Account name, Redis connection string, and Postgres connection string.

### Step B: Populate Key Vault
1. Go to your newly created Azure Key Vault.
2. Manually add all the secrets listed in **Section 1** above. Ensure the names are exactly as written (e.g., `database-url`, `smtp-password`).

### Step C: Update Helm Charts
1. Open `Helm/values-dev.yaml`.
2. Update the `domain`, `tenantId`, `clientId`, `keyvaultName`, `keyvaultUrl`, and `storage.accountName` with your new infrastructure details as shown in **Section 2**.
3. Commit and push these changes to your Git repository.

### Step D: Trigger Frontend Build (GitHub Actions)
1. Because the **Frontend (Next.js)** requires Entra Client ID and Tenant ID during the Docker build process, it relies on GitHub Actions parsing the `values-dev.yaml` file.
2. By pushing your updated `values-dev.yaml`, the GitHub Action (`.github/workflows/ci-frontend.yml`) will automatically trigger.
3. The pipeline will bake the new `NEXT_PUBLIC_ENTRA_CLIENT_ID` and `NEXT_PUBLIC_ENTRA_TENANT_ID` into the frontend image.
4. **Important**: Also ensure your GitHub Repository Secrets (`MAIL_USERNAME`, `MAIL_PASSWORD`, `DEVELOPMENT_TEAM_EMAIL`, `GH_PAT`) are configured in the new repository settings.

### Step E: Deploy Application
1. Once the GitHub pipeline pushes the new frontend image to the container registry, you can apply your Helm charts to the AKS cluster:
   ```bash
   helm upgrade --install flowforge ./Helm -f ./Helm/values-dev.yaml -n flowforge --create-namespace
   ```
2. The backend Python pods will start up, read the `AZURE_KEYVAULT_URL` from the ConfigMap, authenticate using their Managed Identity, and securely pull down all passwords, database URLs, and API keys directly into memory.
