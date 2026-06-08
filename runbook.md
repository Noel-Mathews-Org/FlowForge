# 📘 FlowForge Multi-Cloud Deployment Runbook

This runbook provides the exact steps required to set up your environment, manage your costs, inject your secrets, and access your private Kubernetes cluster.

## 1. 🔑 Cloud CLI Authentication

Before running any Terraform, you must authenticate your local terminal with both Azure and AWS.

### Azure
```bash
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
```

### AWS
You need to install the AWS CLI if you haven't already.
```bash
aws configure
```
*   **AWS Access Key ID:** (Found in AWS IAM -> Users -> Security credentials)
*   **AWS Secret Access Key:** (Found in AWS IAM)
*   **Default region name:** `ap-south-1` (or your chosen region)
*   **Default output format:** `json`

---

## 2. 💰 Cost Estimation & Credit Management

You have **~19k INR ($220 USD)** in Azure and **~$160 USD** in AWS. Your presentation is ~15 days away.

**WARNING:** The architecture we built is an Enterprise-grade Zero-Trust environment. It is expensive to leave running 24/7.
*   **Azure Firewall (Standard):** ~$1.25/hour (~$30/day)
*   **Azure App Gateway (WAF_v2):** ~$0.35/hour (~$8.40/day)
*   **Azure VPN Gateway (VpnGw1):** ~$0.19/hour (~$4.50/day)
*   **AWS Aurora & VPN:** ~$4/day
*   **Total Run Rate:** **~$47 USD / day**

> [!CAUTION]
> If you leave this environment running continuously, your Azure credits will **run out in 4.5 days**.

### The "Deploy & Destroy" Strategy
Because we have fully automated the infrastructure using Terraform, you can safely spin it up when working, and destroy it when sleeping.

**To deploy (Takes ~40 mins):**
1. `cd terraform/aws` -> `terraform apply -auto-approve`
2. `cd ../azure` -> `terraform apply -auto-approve`

**To destroy (Takes ~20 mins):**
*Before logging off for the day:*
1. `cd terraform/azure` -> `terraform destroy -auto-approve`
2. `cd ../aws` -> `terraform destroy -auto-approve`

By only running the infrastructure for 4 hours a day during development, it will cost you less than **$8/day**, ensuring your credits easily last until your presentation!

---

## 3. 🌐 Manual Portal Operations (Post-Terraform)

Terraform will create the Key Vault and the App Registration hooks, but certain security steps must be done manually by you in the Azure Portal.

### Step A: Entra ID App Registration
1. Go to **Microsoft Entra ID** in the Azure Portal -> **App registrations**.
2. Click **New registration** -> Name it `FlowForge-Auth`.
3. Set the Redirect URI (Web) to: `https://flowforge.com/api/auth/callback` (or your AppGW IP during testing).
4. Note down the **Application (client) ID** and **Directory (tenant) ID**.
5. Go to **Certificates & secrets** -> Generate a **New client secret**. Note the **Value** immediately.

### Step B: Key Vault Secrets Injection
Once Terraform finishes, go to the **Key Vault** (`kv-flowforge-...`) in the Azure Portal.
Add the following secrets:

| Secret Name | Value Example | Where to get it |
| :--- | :--- | :--- |
| `DB-CONNECTION-STRING` | `postgresql://flowforgeadmin:SecurePassword123!@aurora-instance.../flowforge` | Build this using the AWS Aurora endpoint from your AWS Console. |
| `REDIS-CONNECTION-STRING` | `rediss://...` | Outputted by `terraform apply` in Azure. |
| `ENTRA-CLIENT-ID` | `1234-abcd-...` | From Step A. |
| `ENTRA-CLIENT-SECRET` | `secret-value` | From Step A. |
| `AI-API-KEY` | `your-openai-key` | Azure AI Foundry Portal. |

---

## 4. 🚀 Accessing the Private AKS Cluster

Because your AKS cluster is fully private and we didn't deploy a Bastion VM (to save vCPU quota), you cannot use normal `kubectl` commands from your local laptop.

Instead, use the **AKS Command Invoke** feature, which tunnels commands securely through the Azure API.

```bash
# Get cluster credentials (so Azure CLI knows which cluster you mean)
az aks get-credentials --resource-group rg-flowforge-prod --name aks-flowforge-prod

# Run any kubectl command securely
az aks command invoke \
  --resource-group rg-flowforge-prod \
  --name aks-flowforge-prod \
  --command "kubectl get pods -n default"

# To deploy the Ingress manifest we just created:
az aks command invoke \
  --resource-group rg-flowforge-prod \
  --name aks-flowforge-prod \
  --command "kubectl apply -f ingress-agic.yaml" \
  --file k8s-manifest/ingress-agic.yaml
```

*(Note: The `--file` argument uploads your local file to the secure temporary pod so `kubectl apply` can read it.)*
