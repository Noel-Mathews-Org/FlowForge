# FlowForge CI/CD Pipeline & Shift-Left Security Guide

This document describes the automated build, test, scan, and deployment pipelines for the FlowForge application monorepo.

---

## 1. Pipeline Architecture

All service CI pipelines share a centralized build workflow to avoid duplication:

```text
  [ FlowForge Monorepo ]
      ├── ci-gateway.yml          ─┐
      ├── ci-auth-service.yml      │  Each calls the central
      ├── ci-frontend.yml          ├─ reusable workflow in:
      ├── ci-project-service.yml   │  Noel-Mathews-Org/.github/.github/
      ├── ci-task-service.yml      │  workflows/_ci-reusable.yml
      ├── ci-analysis-service.yml  │
      ├── ci-notification-worker.yml ┘
      └── prod-release.yml        ─── Separate promotion pipeline
```

**Trigger Rule**: Each service workflow is path-filtered. For example, `ci-gateway.yml` only fires on pushes to `Cloud-Track-dev` that include changes inside the `gateway/` directory. This prevents unnecessary CI runs when unrelated services are modified.

---

## 2. Central Reusable CI Workflow (`_ci-reusable.yml`)

Hosted in: `Noel-Mathews-Org/.github/.github/workflows/_ci-reusable.yml`

Called by individual service workflows with `uses: Noel-Mathews-Org/.github/.github/workflows/_ci-reusable.yml@main`

### Required Inputs
| Input | Description |
| :--- | :--- |
| `service_name` | Directory name of the service (e.g. `gateway`, `auth-service`). |
| `project_key` | SonarQube project key (e.g. `Flow_gateway`). |

### Required Secrets
`MAIL_USERNAME`, `MAIL_PASSWORD`, `DEVELOPMENT_TEAM_EMAIL`, `GH_PAT`, `SONAR_TOKEN`, `SONAR_HOST_URL`, `SNYK_TOKEN`, `AZURE_CI_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ACR_LOGIN_SERVER`

---

### Pipeline Steps (Sequential)

#### Step 1 — Checkout
Full clone with `fetch-depth: 0` for complete git history (required for SonarQube branch delta analysis). Authenticated via `GH_PAT`.

#### Step 2 — Set Variables
Extracts the 7-character short SHA (`short_sha`) from `GITHUB_SHA` for image tagging.

#### Step 3 — SonarQube Scan (SAST)
```yaml
uses: SonarSource/sonarqube-scan-action@master
with:
  projectBaseDir: ./<service_name>
  args: -Dsonar.projectKey=<project_key> -Dsonar.organization=noel-mathews-org
```
- Scans the service subdirectory for security hotspots, code smells, bugs, and coverage.
- `continue-on-error: true` — scan failure does not block the build (non-blocking shift-left feedback).

#### Step 4 — SonarQube Quality Gate
Waits up to 5 minutes for the Quality Gate result.
- `continue-on-error: true` — a failing gate is reported but does not block the image build.

#### Step 5 — Snyk Setup & Scan (SCA)
```bash
cd ./<service_name>
# Installs language dependencies first:
npm install --legacy-peer-deps  # for Node/Next.js services
pip install -r requirements.txt # for Python services

snyk test  --project-name=<service_name>  # scans dependencies
snyk monitor --project-name=<service_name>  # registers snapshot in Snyk dashboard
```
- `continue-on-error: true` — open-source CVEs are reported but do not block the build.

#### Step 6 — Docker Build
```bash
# 1. Clone FlowForge-Helm on the matching branch
git clone https://x-access-token:<GH_PAT>@github.com/Noel-Mathews-Org/FlowForge-Helm.git helm-repo-tmp

# 2. Extract Entra parameters from values-dev.yaml using yq
ENTRA_CLIENT_ID=$(yq '.global.entra.clientId' helm-repo-tmp/Helm/values-dev.yaml)
ENTRA_TENANT_ID=$(yq '.global.azure.tenantId' helm-repo-tmp/Helm/values-dev.yaml)

# 3. Build image with Entra params baked in as build-args
docker build \
  --build-arg NEXT_PUBLIC_ENTRA_CLIENT_ID=$ENTRA_CLIENT_ID \
  --build-arg NEXT_PUBLIC_ENTRA_TENANT_ID=$ENTRA_TENANT_ID \
  -t <ACR_LOGIN_SERVER>/flowforge/<service_name>:<short_sha> \
  ./<service_name>
```
> The Helm clone ensures the frontend always uses the current environment's Entra IDs from the central configuration source, not hardcoded values.

#### Step 7 — Trivy Container Scan
```yaml
uses: aquasecurity/trivy-action@master
with:
  image-ref: '<ACR>/flowforge/<service>:<sha>'
  severity: 'CRITICAL,HIGH'
  exit-code: '0'
  ignore-unfixed: true
```
- Scans the built image for OS package and library CVEs at `CRITICAL` and `HIGH` severity.
- `exit-code: '0'` — scan failure is informational and non-blocking.

#### Step 8 — Azure Login via OIDC
```yaml
uses: azure/login@v2
with:
  client-id: ${{ secrets.AZURE_CI_CLIENT_ID }}
  tenant-id: ${{ secrets.AZURE_TENANT_ID }}
  subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```
Authenticates using the `mi-github-actions-prod` Managed Identity via OIDC — no client secrets stored in GitHub.

#### Step 9 — ACR Login & Push
```bash
az acr login --name <ACR_LOGIN_SERVER>
docker push <ACR_LOGIN_SERVER>/flowforge/<service_name>:<short_sha>
```

#### Step 10 — GitOps Helm Update
```bash
git clone https://x-access-token:<GH_PAT>@.../FlowForge-Helm.git helm-repo
cd helm-repo && git checkout Cloud-Track-dev

# Update the image tag for this service in values-dev.yaml
yq eval '."<service_name>".image.tag = "<short_sha>"' -i Helm/values-dev.yaml

git config user.name "FlowForge Dev Pipeline"
git commit -m "chore(gitops): update <service> to <sha> in dev"
git push origin Cloud-Track-dev
```
ArgoCD detects the change in `FlowForge-Helm` on `Cloud-Track-dev` and automatically syncs the new image into the `dev` namespace.

#### Step 11 — Email Notification
Sends a styled HTML status email (✅ PASSED / ❌ FAILED / ⚠️ CANCELLED) to `DEVELOPMENT_TEAM_EMAIL` containing:
- Pipeline status with color-coded header.
- Commit author, short SHA link, commit message.
- Link to the GitHub Actions run logs.

---

## 3. Production Release & Promotion (`prod-release.yml`)

**Trigger**: `on: release: types: [published]`

When a GitHub Release is published with a tag in the format `<service-name>-v<semver>` (e.g. `gateway-v1.3.0`), this pipeline:

### Steps:

1. **Parse Release Tag** — Extracts the service name and semantic version from the tag using `sed`/`grep`. Fails if the format is invalid.

2. **Fetch Dev SHA** *(Microservices only)*:
   - Clones `FlowForge-Helm` on `Cloud-Track-dev`.
   - Reads the current image tag (short SHA) from `Helm/values-dev.yaml` using `yq`.
   - This SHA is the **verified binary** tested in Dev, ensuring only battle-tested images go to Prod.

3. **Azure Login** — Same OIDC login as the dev pipeline.

4. **Pull & Retag** *(Microservices only)*:
   ```bash
   docker pull <ACR>/flowforge/<service>:<dev_sha>
   docker tag <ACR>/flowforge/<service>:<dev_sha> <ACR>/flowforge/<service>:<version>
   ```
   No new image is built — the exact Dev image is promoted.

5. **Frontend Build** *(Frontend only)*:
   - Fetches `ENTRA_CLIENT_ID` and `ENTRA_TENANT_ID` from `Helm/values-prod.yaml`.
   - Rebuilds the Next.js image with **production** Entra parameters baked in.

6. **Pre-Promotion Trivy Scan** — Scans the release-tagged image before pushing.

7. **Push to ACR** — Pushes the release-tagged image.

8. **Update `values-prod.yaml`**:
   - Clones `FlowForge-Helm` on `main`.
   - Updates the service tag to `<version>` in `Helm/values-prod.yaml`.
   - Commits and pushes to `main`, triggering ArgoCD for the `prod` namespace.

9. **Email Notification** — Release status email to the team.

---

## 4. Shift-Left Security Summary

| Phase | Tool | Type | Blocking? |
| :--- | :--- | :--- | :--- |
| Code commit | **SonarQube** | SAST (Static Code Analysis) | Non-blocking (informational) |
| Pre-build | **Snyk** | SCA (Dependency Vulnerability Scan) | Non-blocking (informational) |
| Post-build | **Trivy** | Container Image Scan (OS/Library CVEs) | Non-blocking (informational) |
| All auth | **OIDC** | Passwordless identity federation | N/A — eliminates static credentials |

All scan tools are configured as non-blocking (`continue-on-error: true` / `exit-code: '0'`) to avoid blocking training and development velocity while still providing security visibility. Results are visible in SonarQube, Snyk Dashboard, and GitHub Actions logs.
