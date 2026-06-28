# FlowForge Operations & Deployment Runbook

This runbook outlines the step-by-step procedure to stand up the FlowForge infrastructure, configure Entra ID SSO, bootstrap database permissions, and deploy the application services.

---

## Step 1: Bootstrap the Terraform Backend State
Run the manual bootstrapping script from your PowerShell console to provision the storage resources where Terraform will keep the remote statefile.

```powershell
# Navigate to scripts directory in FlowForge-Terraform
cd FlowForge-Terraform/scripts

# Execute the bootstrap script (make sure you are authenticated with Azure CLI)
./bootstrap_backend.ps1
```

* **What it does**: Creates the Azure Storage Account and container (`tfstate`) to hold the remote state.
* **Access Control**: Grants the operator's account the `Storage Blob Data Contributor` role on the backend storage.

---

## Step 2: Deploy Cloud Infrastructure via Terraform
Execute the Terraform GitOps pipeline to deploy the network resources, security firewalls, AKS cluster, and PaaS resources.

1. Configure the following environment variables or secrets in your GitHub repository:
   * `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
   * `POSTGRES_ADMIN_USERNAME`, `POSTGRES_ADMIN_PASSWORD`
   * `JUMPBOX_ADMIN_PASSWORD`
2. Commit changes or trigger the workflow:
   * Push to `Cloud-Track-dev` to deploy the **Dev** environment.
   * Merge to `main` and approve the manual promotion gate to deploy the **Production** environment.

---

## Step 3: Configure Microsoft Entra ID App Registration
Configure the App Registration manually in the Azure Portal:

1. **Create App Registration**: Name it `FlowForge`.
2. **Setup Redirect URIs**: Under Authentication, add a **Single-Page Application (SPA)** platform. Add redirect URIs:
   * Dev: `https://dev.flowforge.com/login`
   * Prod: `https://flowforge.com/login`
3. **Register Groups**: Go to Entra ID > Groups and create four security groups:
   * `FlowForge-Platform-Admins`
   * `FlowForge-Org-Owners`
   * `FlowForge-Managers`
   * `FlowForge-Members`
4. **Acquire Object IDs**: Copy the Object ID of each group and keep them for the Key Vault update step.

---

## Step 4: Bootstrap Database Permissions
Because the application pods connect to PostgreSQL using passwordless Managed Identities, you must register these identities inside the database engine.

Run the local setup script from a shell with access to `kubectl` connected to your AKS cluster:

```powershell
# Navigate to db-permission directory in FlowForge-Terraform
cd FlowForge-Terraform/db-permission

# Run the setup script
./run-setup.ps1
```

* **What it does**:
  1. Requests an Entra ID token for PostgreSQL.
  2. Compiles a Kubernetes Job template (`db-job-applied.yaml`) replacing `__TOKEN__` with the access token.
  3. Launches the Job (`db-setup-job-v2`) in AKS. The job executes `setup.sql` to call the `pgaadauth_create_principal` extension, registering the managed identities as database users and granting the required schema permissions.

---

## Step 5: Sync Application Secrets to Key Vault
Run the **Key Vault Secret Sync Pipeline** (`update-keyvault-secrets.yml`) manually via GitHub Actions workflow dispatch:

1. Ensure the application environment variables (such as `REDIS_URL`, `JWT_SECRET`, `ENTRA_CLIENT_SECRET`, and the Entra Group Object IDs) are populated inside the GitHub environment secrets (`dev` or `prod`).
2. Trigger the workflow.
3. The self-hosted runner will connect to Key Vault, sync the secrets, and automatically disable older versions of active secrets to maintain security hygiene.

---

## Step 6: Deploy Kubernetes Manifests via ArgoCD
With all backing infrastructure and secrets provisioned, deploy the Kubernetes manifests:

1. Push your configurations to the `FlowForge-Helm` repository.
2. The ArgoCD agent inside the AKS cluster will detect changes to `Helm/values-dev.yaml` or `Helm/values-prod.yaml` and pull down the images from ACR to deploy.
