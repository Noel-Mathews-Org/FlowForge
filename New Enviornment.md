# FlowForge v2.0.0 Prod Release Plan

I have created `upload_secrets.sh` for you to use in Linux/Git Bash environments. You can run it like this: `bash upload_secrets.sh -v kv-prod-ff-001` (make sure to populate `secrets.env` first!).

I have thoroughly scanned your GitHub Actions workflows (`_ci-reusable.yml` and `prod-release.yml`), your Helm charts, and your deployment architecture. Here is the exact end-to-end plan to successfully deploy `v2.0.0` to your new production cluster.

## User Review Required

> [!IMPORTANT]  
> **How Frontend Variables Work in your Pipeline:**
> You asked which `values.yaml` to update to ensure the frontend image gets created correctly. 
> Looking at `_ci-reusable.yml`, the pipeline **bakes the variables into the frontend image at build time** by reading them from `Helm/values-dev.yaml`. 
> When you promote to Prod, your `prod-release.yml` pipeline simply **retags the Dev image** to `v2.0.0`. It does *not* rebuild the image. 
> Therefore, the frontend image in Prod will use the variables baked into it during the Dev build. Fortunately, your `tenantId` and `clientId` are identical in both `values-dev.yaml` and `values-prod.yaml`, so this will work perfectly without any code changes! Just ensure `values-dev.yaml` has the correct `clientId` and `tenantId` before you push.

## Proposed Steps

Follow these exact steps in order:

### 1. Update `values-prod.yaml` (on the Dev branch)
You must update your `values-prod.yaml` file on the `Cloud-Track-dev` branch with the new infrastructure details outputted by Terraform.
Update the following fields under `global.azure` and `global.storage`:
*   `keyvaultName: "kv-prod-ff-001"`
*   `keyvaultUrl: "https://kv-prod-ff-001.vault.azure.net/"`
*   `managedIdentityClientId: "ace9a935-229d-46f4-81bf-ec140cae7079"` *(This is your aks_kubelet_identity_client_id)*
*   `storage.accountName: "stffprod001"`

### 2. Push to `Cloud-Track-dev`
Commit your updated `values-prod.yaml` and push to the `Cloud-Track-dev` branch.
*   **What this does:** This triggers your 7 CI pipelines (`ci-frontend.yml`, `ci-auth-service.yml`, etc.). They will build fresh images (baking the frontend variables from `values-dev.yaml` into the Next.js image) and update `values-dev.yaml` with the new short commit SHA tags.

### 3. Open PR to `Cloud-Track-prod`
Once the Dev pipelines finish successfully, open a Pull Request from `Cloud-Track-dev` to `Cloud-Track-prod` and merge it.
*   **What this does:** This synchronizes your updated `values-prod.yaml` into the production branch.

### 4. Create v2.0.0 GitHub Releases
Go to your GitHub repository and create 7 new releases. The tag names **must strictly match** this format for your pipeline to parse them correctly:
*   `frontend-v2.0.0`
*   `auth-service-v2.0.0`
*   `gateway-v2.0.0`
*   `project-service-v2.0.0`
*   `task-service-v2.0.0`
*   `analysis-service-v2.0.0`
*   `notification-worker-v2.0.0`

*   **What this does:** This triggers `prod-release.yml` 7 times. The pipeline will fetch the latest image from Dev, run Trivy security scans, retag the image as `v2.0.0`, push it to your registry, and automatically update `Helm/values-prod.yaml` on the `Cloud-Track-prod` branch with the new `v2.0.0` image tags.

### 5. Setup ArgoCD
Since you already have ArgoCD installed in your Prod cluster, you now just need to create the ArgoCD Application.
Point ArgoCD to:
*   **Repository URL:** Your GitHub repo URL.
*   **Revision:** `Cloud-Track-prod` (Important: Point it to the prod branch!)
*   **Path:** `Helm`
*   **Values Files:** `values-prod.yaml`

ArgoCD will read the `values-prod.yaml` file (which the pipeline just automatically updated to `v2.0.0`), see the new image tags and infrastructure settings, and deploy the entire v2.0.0 stack to your cluster!
