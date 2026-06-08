# 🌩️ FlowForge Cloud Architecture & Deployment Blueprint

This master document serves as your definitive guide for deploying and managing the FlowForge microservices architecture in a multi-cloud (Azure + AWS), Zero-Trust environment.

---



## 1. Application Overview & Services

FlowForge is a distributed microservices application designed for enterprise scale. 
*   **Frontend (Next.js)**: The user-facing portal. 
*   **Gateway (Python)**: The BFF (Backend-for-Frontend) API Gateway that routes traffic internally.
*   **Auth Service**: Handles Microsoft Entra ID (Azure AD) SSO, RBAC mapping, and token generation.
*   **Project Service**: Manages core business logic for projects.
*   **Task Service**: Manages tasks assigned within projects.
*   **Analysis Service**: Integrates with Azure AI Foundry to generate intelligent summaries.
*   **Notification Worker**: A background worker that pulls events (via Service Bus/Redis) and delivers emails via SMTP.

---

## 2. Secrets Management & Key Vault Integration

Your application is architected to be completely **credential-less** on disk. All Python microservices natively use the `DefaultAzureCredential` SDK to fetch secrets securely at startup.

### 🔑 How It Works in Different Environments:
*   **Docker Compose (Local/VM)**: The system relies on your local `az login` credentials. The containers will pull the secrets directly from Azure Key Vault into memory (`os.environ`).
*   **AKS (Production)**: The pods inherit the AKS Node's **Managed Identity**. They transparently authenticate to Key Vault without any code changes, mounting, or CSI drivers required.

### 🗺️ The Definitive Key Vault Mapping
You must ensure the following secrets exist in your Azure Key Vault. The Python SDK (`keyvault.py`) automatically maps these exact Key Vault names into the Environment Variables the app expects:

| Key Vault Secret Name | Environment Variable | Description |
| :--- | :--- | :--- |
| `database-url` | `DATABASE_URL` | The AWS Aurora PostgreSQL connection string. |
| `redis-url` | `REDIS_URL` | The Azure Cache for Redis connection string. |
| `azure-foundry-key` | `AZURE_FOUNDRY_KEY` | API Key for your external Azure AI Foundry model. |
| `smtp-password` | `SMTP_PASSWORD` | Password for the SMTP email sender. |
| `jwt-secret` | `JWT_SECRET` | Secret key used to sign JWT session tokens. |
| `internal-api-key` | `INTERNAL_API_KEY` | Key used for secure service-to-service communication. |
| `entra-client-secret` | `ENTRA_CLIENT_SECRET` | The client secret generated during App Registration. |
| `azure-storage-connection-string` | `AZURE_STORAGE_CONNECTION_STRING` | Connection string for the Blob Storage account. |
| `entra-group-platform-admin` | `ENTRA_GROUP_PLATFORM_ADMIN` | Object ID of the Platform Admin security group. |
| `entra-group-org-owner` | `ENTRA_GROUP_ORG_OWNER` | Object ID of the Org Owner security group. |
| `entra-group-manager` | `ENTRA_GROUP_MANAGER` | Object ID of the Manager security group. |
| `entra-group-member` | `ENTRA_GROUP_MEMBER` | Object ID of the Member security group. |

> **Note on Feasibility:** Passing the `DATABASE_URL` and `REDIS_URL` via Key Vault is highly recommended and fully supported by your codebase. This guarantees that your connection strings are never exposed in Kubernetes ConfigMaps or Docker `.env` files.

---

## 3. Entra ID (Azure AD) Setup Guide

Because Terraform cannot easily manage Azure AD objects without elevated tenant-level permissions, you must perform these steps manually in the Azure Portal before deployment:

1.  **App Registration**: Create a new App Registration named "FlowForge".
2.  **Authentication**: Add a "Single-page application (SPA)" platform. Set the Redirect URI to your Front Door URL (e.g., `https://flowforge.com/login`).
3.  **Certificates & Secrets**: Generate a new Client Secret. Store its value in Key Vault as `entra-client-secret`.
4.  **API Permissions**: Ensure `User.Read` (Delegated) is granted.
5.  **Groups Creation**: Go to Entra ID > Groups and create four Security Groups:
    *   `FlowForge-Platform-Admins`
    *   `FlowForge-Org-Owners`
    *   `FlowForge-Managers`
    *   `FlowForge-Members`
6.  **Store Group IDs**: Copy the **Object ID** of each group and store them in Key Vault under their respective `entra-group-*` secret names (listed in the table above).

---

## 4. Infrastructure Provisioning Guide (Step-by-Step)

When deploying to a new environment, follow this exact sequence to stand up the Hub & Spoke architecture:

### Phase 1: Bootstrapping State
1.  Run the local `bootstrap_backend.ps1` script.
2.  This script manually creates the Azure Storage Account (with a `tfstate` blob container) and the AWS S3 Bucket (with a DynamoDB lock table). This solves the "chicken and egg" problem for remote Terraform state.

### Phase 2: Deploy AWS (Database Layer)
1.  Navigate to `terraform/aws`.
2.  Run `terraform init` and `terraform apply`.
3.  This provisions the AWS VPC, Private Subnets, Aurora PostgreSQL DB, and the AWS side of the Site-to-Site VPN. 
4.  *Note the AWS VPN Public IP from the outputs.*

### Phase 3: Deploy Azure (Core Infrastructure & PaaS)
1.  Navigate to `terraform/azure`.
2.  Paste the AWS VPN Public IP into your `terraform.tfvars`.
3.  Run `terraform init` and `terraform apply`.
4.  **This single command provisions everything in the correct dependency order:**
    *   **Networking**: Hub VNet, Spoke VNet, and all subnets (Firewall, Bastion, AppGW, Gateway, AKS, Private Endpoints).
    *   **PaaS Layer**: Azure Cache for Redis (Standard C1, non-clustered, 1GB), Key Vault, and Storage Account (with `app-data` container).
    *   **Private Endpoints**: Injects the PaaS resources into the `pe_subnet` and links them via Private DNS Zones.
    *   **Security (RBAC)**: Assigns Key Vault and Storage access to the AKS Managed Identity.
    *   **VPN**: Stands up the Azure Virtual Network Gateway and connects it via IPsec/BGP to AWS.
    *   **Protection**: Deploys Azure Firewall and the Application Gateway.
    *   **Compute**: Deploys the private AKS cluster.
    *   **Edge**: Deploys Azure Front Door and links it to the App Gateway.

### Phase 4: Deploying the Application to AKS
1.  Connect to your AKS cluster via `az aks get-credentials`.
2.  Deploy your Kubernetes manifests.
3.  **The Magic of ILB**: Your `gateway` pod is exposed using an Internal Load Balancer service (`service.beta.kubernetes.io/azure-load-balancer-internal: "true"`). This ILB receives traffic exclusively from the Application Gateway/Firewall. The cluster nodes remain entirely hidden from the public internet.

---

## 5. Network Firewall Egress Rules

Because AKS forces outbound traffic through the Azure Firewall (`outbound_type = "userDefinedRouting"`), the Terraform script automatically configures the following rules to ensure the app functions:

*   **Allow Port 5432 (Network Rule)**: Out to the AWS VPC CIDR for database connectivity.
*   **Allow Port 6379/10000 (Network Rule)**: Out to the Azure Redis Private Endpoint.
*   **Allow `*.services.ai.azure.com` (App Rule)**: Outbound HTTPS for the Analysis Service AI Foundry integration.
*   **Allow `login.microsoftonline.com` (App Rule)**: Outbound HTTPS for Entra ID token validation.
*   **Allow `smtp.gmail.com:587` (App Rule)**: Outbound for the Notification Worker.
*   **Allow `ghcr.io` (App Rule)**: Outbound HTTPS to pull Docker container images.

---

## 6. Security Architecture Deep Dive (Q&A)

### Q: How are Key Vault, Redis, and Storage deployed securely?
**A:** They are deployed completely detached from the public internet. During Terraform provisioning, we inject a **Private Endpoint** for each of these services directly into your `pe_subnet`. To your application, Redis and Key Vault look like local IP addresses inside your Virtual Network. Public access to these resources is explicitly denied at the Azure Resource Manager level.

### Q: How is Azure Key Vault secured with RBAC?
**A:** Instead of using legacy "Access Policies", we deployed Key Vault using the modern **Azure Role-Based Access Control (RBAC)** model. This means permissions are managed centrally.
*   The human executor of the Terraform script is granted the `Key Vault Administrator` role.
*   The AKS cluster is granted the `Key Vault Secrets User` role.
*   This grants zero permissions to anything else in the VNet unless explicitly authorized.

### Q: In the AKS cluster, how does our app get all the secrets? Is it capable?
**A:** **Yes, your application is 100% capable right now.** 
Because your Python code utilizes `DefaultAzureCredential()` within `keyvault.py`, it behaves beautifully:
1.  When a pod boots up in AKS, the Python SDK asks the underlying node for an identity token.
2.  AKS intercepts this and provides a token for the cluster's **Managed Identity**.
3.  The Python SDK presents this token to the Key Vault.
4.  Because we gave the Managed Identity the `Key Vault Secrets User` role, Key Vault immediately returns the Database URL, Redis URL, AI Foundry Key, etc.
**No code changes, no Kubernetes Secret objects, and no CSI volumes are required.** Your pods simply wake up, authenticate passwordlessly, and pull what they need into memory.

### Q: How do we authenticate with Azure Storage and AI Foundry securely?
*   **Storage Account**: We completely removed the `AZURE_STORAGE_CONNECTION_STRING` from the codebase. The app now uses `AZURE_STORAGE_USE_MANAGED_IDENTITY=true`. It uses the exact same passwordless Managed Identity token flow described above to read/write blobs securely.
*   **AI Foundry**: Your `analysis-service` makes a standard outbound HTTPS call to the AI Foundry Endpoint, passing the `AZURE_FOUNDRY_KEY` (which it pulled from Key Vault) in the request header. This is the industry-standard way to consume external AI models.
