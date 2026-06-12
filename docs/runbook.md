# FlowForge Cluster Setup Runbook

This guide contains the exact steps required to set up a brand new FlowForge cluster immediately after running `terraform apply`.

## Prerequisites
- You have run `terraform apply` successfully.
- You have the Azure CLI (`az`) and `kubectl` installed.
- You are logged into Azure (`az login`).

## Step 1: Connect to the Cluster
First, authenticate your local `kubectl` to the newly provisioned AKS cluster.

```bash
# For Dev:
az aks get-credentials --resource-group rg-dev-app --name aks-dev --overwrite-existing

# For Prod:
az aks get-credentials --resource-group rg-prod-app --name aks-prod --overwrite-existing
```

## Step 2: Install ArgoCD
ArgoCD manages our GitOps deployments.

```bash
# 1. Create the namespace
kubectl create namespace argocd

# 2. Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 3. Wait for the pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# 4. Forward the port so you can access the UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```
You can now access the ArgoCD UI at `https://localhost:8080`.

**Get the Initial Admin Password:**
Keep this port-forward running in one terminal, and open a new terminal to fetch the password:
```bash
kubectl get secret argocd-initial-admin-secret \
  -n argocd \
  -o jsonpath="{.data.password}" | base64 --decode
```
*Login with username `admin` and the password printed above.*

## Step 3: Install Cert-Manager
Cert-Manager automatically provisions Let's Encrypt SSL certificates for our domains.

```bash
# Install Cert-Manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.1/cert-manager.yaml

# Wait for Cert-Manager webhooks to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s
```

## Step 4: Configure the Cluster Issuer
Create the Let's Encrypt ClusterIssuer which tells Cert-Manager how to validate our domain using the Azure Application Gateway.

Create a file named `issuer.yaml` with the following content:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: bloodymaryy77@gmail.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: azure/application-gateway
```

Apply it to the cluster:
```bash
kubectl apply -f issuer.yaml
```

## Step 5: Gather Terraform Outputs & Update Variables

Run the following command in your terraform directory to get the critical values needed for the Key Vault and `values.yaml`:

```bash
terraform output -json
```

### A. Secrets to Store in Azure Key Vault

These values are highly sensitive. They are fetched dynamically at application runtime by the backend Python services using the AKS Kubelet Identity. 

**You must manually create these exact secret names in your new Azure Key Vault:**

#### Databases & Caching
*   `database-url` : The PostgreSQL connection string outputted by Terraform.
*   `redis-url` : The Azure Managed Redis connection string outputted by Terraform.

#### Security & Internal Auth
*   `jwt-secret` : A secure, random string used to sign JWT tokens.
*   `internal-api-key` : A secure, random string used for service-to-service internal communication.
*   `entra-client-secret` : The client secret for your Azure AD (Entra) Application Registration.
*   `entra-client-id` : The `aks_kubelet_identity_client_id` outputted by Terraform (or your App Reg Client ID).
*   `entra-tenant-id` : The `azure_tenant_id` outputted by Terraform.

#### Azure AI Foundry
*   `azure-foundry-key` : API key for your Azure AI Foundry resource.
*   `azure-foundry-endpoint` : Endpoint URL for your Azure AI Foundry resource.

#### SMTP / Email Delivery
*   `smtp-username` : The email address used to authenticate with the SMTP server.
*   `smtp-password` : The app password or SMTP password for the above email.

#### Entra ID RBAC Groups (Object IDs)
*   `entra-group-platform-admin` : Object ID for Platform Admin group.
*   `entra-group-org-owner` : Object ID for Org Owner group.
*   `entra-group-manager` : Object ID for Manager group.
*   `entra-group-member` : Object ID for Member group.

### B. Variables Configured in Helm (`values-dev.yaml`)

> **CRITICAL ARCHITECTURE NOTE (The "Dual-Use" Variables):**
> Because Next.js (the Frontend) requires variables at *build time*, the GitHub Actions workflow parses `values-dev.yaml` to bake the Entra Tenant ID and Client ID directly into the frontend image. 
> However, the Backend securely pulls these same values directly from the Azure Key Vault at *runtime*.
> **Therefore, the Entra Tenant ID and Client ID must exist in BOTH the Azure Key Vault AND the `values-dev.yaml` file.**

Update `Helm/values-dev.yaml` with your new infrastructure details:

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

Commit and push `values-dev.yaml` to your repository.

### C. Trigger Frontend Build (GitHub Actions)

1. By pushing your updated `values-dev.yaml`, the GitHub Action (`.github/workflows/ci-frontend.yml`) will automatically trigger.
2. The pipeline will bake the new `NEXT_PUBLIC_ENTRA_CLIENT_ID` and `NEXT_PUBLIC_ENTRA_TENANT_ID` into the frontend image.
3. **Important**: Ensure your GitHub Repository Secrets (`MAIL_USERNAME`, `MAIL_PASSWORD`, `DEVELOPMENT_TEAM_EMAIL`, `GH_PAT`) are configured in the new repository settings.

## Step 6: Deploy the Application

Once the GitHub pipeline finishes pushing the new frontend image to the container registry, you can apply your ArgoCD manifest to start syncing the microservices:

```bash
kubectl apply -f argocd/argocd-dev-app.yaml
```

The backend pods will automatically read the `AZURE_KEYVAULT_URL` from the ConfigMap, authenticate using their Managed Identity, and securely pull down all passwords, database URLs, and API keys directly into memory.
