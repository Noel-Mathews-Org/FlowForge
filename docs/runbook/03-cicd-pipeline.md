# 03 - CI/CD Pipeline Design

**Parent:** [Runbook Index](./00-index.md)

---

## 3.1 Pipeline Philosophy

The FlowForge CI/CD system is designed around two core principles:

1. **Security is not optional.** Every code change passes through SAST, SCA, and container image scanning before a Docker image is ever pushed to the registry. A vulnerability does not block the pipeline outright but is logged and reported to the team, enabling an informed decision before promotion to production.

2. **The pipeline governs deployment, not humans.** A developer never manually tags or pushes a Docker image. The pipeline computes the correct image tag from the Git commit SHA, pushes the image, and then directly updates the Helm values file in the repository. Argo CD reads that file and syncs the cluster. The loop is fully automated and auditable.

---

## 3.2 Workflow File Architecture

The CI system uses a **reusable workflow** pattern. There is one caller workflow per service and one shared implementation.

| File | Role |
|:---|:---|
| `.github/workflows/_ci-reusable.yml` | The shared logic: SonarQube, Snyk, Docker build, Trivy, GHCR push, values update |
| `.github/workflows/ci-auth-service.yml` | Triggers on push to `test` branch, paths: `auth-service/**` |
| `.github/workflows/ci-frontend.yml` | Triggers on push to `test` branch, paths: `frontend/**` |
| `.github/workflows/ci-gateway.yml` | Triggers on push to `test` branch, paths: `gateway/**` |
| `.github/workflows/ci-project-service.yml` | Triggers on push to `test` branch, paths: `project-service/**` |
| `.github/workflows/ci-task-service.yml` | Triggers on push to `test` branch, paths: `task-service/**` |
| `.github/workflows/ci-analysis-service.yml` | Triggers on push to `test` branch, paths: `analysis-service/**` |
| `.github/workflows/prod-release.yml` | Triggers on GitHub Release publication |

Each caller workflow invokes `_ci-reusable.yml` and passes the `service_name` and SonarQube `project_key` as inputs. All secrets are forwarded from the repository's GitHub Secrets store.

---

## 3.3 Dev Pipeline: Stage-by-Stage Breakdown

This pipeline runs when a developer pushes to the `test` branch and the changed files are within a service's subdirectory.

### Stage 1: Checkout and Variable Setup

```
actions/checkout@v4
  fetch-depth: 0       # Full history required for SonarQube blame analysis
  token: GH_PAT        # Personal Access Token for write-back to repo later
```

The 7-character short Git SHA is extracted and stored as `short_sha`. This value becomes the Docker image tag for this entire pipeline run.

```
short_sha = GITHUB_SHA[:7]
# Example: a97a9b2
```

### Stage 2: SonarQube SAST Scan

```
sonarsource/sonarqube-scan-action@v2
  projectBaseDir: <service_name>
  args:
    -Dsonar.projectKey=<project_key>
    -Dsonar.scanner.metadataFilePath=/github/workspace/.scannerwork/report-task.txt
```

The scanner analyzes the source code for:
- Security vulnerabilities (SQL injection, XSS, insecure deserialization)
- Code smells and duplication
- Coverage gaps
- Bug patterns

The scan report is written to `.scannerwork/report-task.txt` for the quality gate action to consume.

### Stage 3: SonarQube Quality Gate Check

```
sonarsource/sonarqube-quality-gate-action@v1
  scanMetadataReportFile: .scannerwork/report-task.txt
  continue-on-error: true
  timeout-minutes: 5
```

This step polls the SonarQube server and waits for the quality gate result. `continue-on-error: true` is set because the pipeline is designed to **report** failures rather than block development. The team is notified via email in all cases. This allows engineers to make an informed decision at the promotion stage rather than creating an emergency stop on every commit.

For the quality gate parameters to configure on the SonarQube server, see [11 - Code Quality](./11-code-quality.md).

### Stage 4: Snyk Software Composition Analysis (SCA)

For Python services:
```
cd <service_name>
pip install -r requirements.txt
npx snyk test --severity-threshold=high
```

For the frontend:
```
cd frontend
npm install
npx snyk test --severity-threshold=high
```

Snyk inspects the dependency tree (`requirements.txt` for Python, `package.json` for Node) and identifies known CVEs in third-party libraries. The `--severity-threshold=high` flag means only HIGH and CRITICAL vulnerabilities are flagged. This step also uses `continue-on-error: true` and the team is notified.

### Stage 5: Docker Image Build

```
docker build \
  -t ghcr.io/<org>/<repo>/<service_name>:<short_sha> \
  ./<service_name>
```

The image is built from the service's Dockerfile. It is tagged with the short SHA. The image is built locally on the runner at this stage and is **not yet pushed**. The Trivy scan runs against this local image before it reaches any registry.

### Stage 6: Trivy Container Image Scan

```
aquasecurity/trivy-action@master
  image-ref: ghcr.io/<org>/<repo>/<service_name>:<short_sha>
  format: table
  exit-code: 0
  severity: CRITICAL,HIGH
```

Trivy scans the built image for:
- OS-level package vulnerabilities (Alpine, Debian)
- Application library vulnerabilities embedded in the image
- Misconfigurations

`exit-code: 0` means the pipeline continues even if vulnerabilities are found, but all findings are printed to the GitHub Actions log for review.

### Stage 7: Push to GHCR

```
docker/login-action@v3
  registry: ghcr.io
  username: github.actor
  password: GITHUB_TOKEN

docker push ghcr.io/<org>/<repo>/<service_name>:<short_sha>
```

Only after passing the Trivy scan is the image pushed to the private GitHub Container Registry. The image is stored as an immutable artifact tagged with the commit SHA.

### Stage 8: Update values-dev.yaml (GitOps Write-Back)

```
git pull --rebase origin test
yq eval ".<service_name>.image.tag = \"<short_sha>\"" -i Helm/values-dev.yaml
git config user.name "FlowForge Dev Pipeline"
git config user.email "devops@flowforge.com"
git add Helm/values-dev.yaml
git commit -m "chore(gitops): update <service_name> to <short_sha> in dev"
git push origin test
```

This is the bridge between CI and CD. The pipeline opens the Helm values file, updates only the image tag for the changed service, and commits the file back to the `test` branch using `yq`. This commit triggers Argo CD to detect a drift between the cluster state and the desired state in Git, which causes an automatic sync.

### Stage 9: Email Notification

A formatted HTML email is sent to the development team for every pipeline run, regardless of success or failure. The email contains:
- Pipeline status (PASSED / FAILED / CANCELLED)
- Commit author and message
- 7-character commit SHA with a direct link to the GitHub commit
- A button linking directly to the GitHub Actions run log

---

## 3.4 Production Release Pipeline: Stage-by-Stage Breakdown

This pipeline is triggered exclusively by publishing a **GitHub Release**. It runs on the `prod` branch checkout. It does not build any new Docker images. Instead, it promotes an image that has already been validated in the development environment.

### Trigger

A release must be tagged in the format: `<service-name>-v<major>.<minor>.<patch>`

Example: `auth-service-v1.2.0`

### Stage 1: Parse Release Tag

The pipeline extracts the service name and semantic version from the release tag using `sed` and `grep`. If the tag format is invalid, the pipeline exits immediately with an error.

```
TAG_NAME=auth-service-v1.2.0
SERVICE=auth-service
VERSION=v1.2.0
```

### Stage 2: Fetch Dev SHA (The Governance Gate)

This is the most critical security and governance step in the entire pipeline.

```
git fetch origin test
git show origin/test:Helm/values-dev.yaml > values-dev-temp.yaml
DEV_SHA=$(yq eval ".<service>.image.tag" values-dev-temp.yaml)
```

The pipeline reads the **current image tag from the dev environment**. This SHA represents the image that has been running in dev, has passed all CI scans, and has been validated by engineers. This SHA is then used to fetch the exact same image from GHCR for promotion to production.

**Why this matters:** A human cannot manually specify an arbitrary SHA in the release. The pipeline enforces that only an image that was built, scanned, and deployed to dev can ever go to production. It is impossible to deploy an unscanned or untested image to production through this pipeline.

### Stage 3: Trivy Re-Scan Before Promotion

The dev SHA image is pulled from GHCR and scanned again with Trivy. This second scan guards against newly published CVEs that may have been discovered between the time the image was built and when the release is created.

### Stage 4: Retag with Semantic Version and Push

```
docker tag <image>:<dev_sha> <image>:<semver>
docker push <image>:<semver>
# Example result: ghcr.io/noel-mathews-org/flowforge/auth-service:v1.2.0
```

The image is retagged with the human-readable semantic version. Both the SHA tag and the semver tag now exist in GHCR, pointing to the exact same image layers.

### Stage 5: Update values-prod.yaml (GitOps Write-Back)

```
yq eval ".<service>.image.tag = \"<version>\"" -i Helm/values-prod.yaml
git commit -m "chore(release): promote <service> to <version> in PROD"
git push origin prod
```

The `values-prod.yaml` on the `prod` branch is updated with the new semantic version tag. Argo CD, which watches the `prod` branch, detects this change and syncs the production namespace. Because the backend services use a **Canary Rollout strategy**, Argo CD applies the new image but Argo Rollouts pauses at the 50% traffic split, waiting for a human to manually promote.

---

## 3.5 GitHub Secrets Required

| Secret Name | Used By | Purpose |
|:---|:---|:---|
| `SONAR_TOKEN_AUTH` | ci-auth-service | SonarQube token for auth project |
| `SONAR_TOKEN_PROJECT` | ci-project-service | SonarQube token for project project |
| `SONAR_TOKEN_TASK` | ci-task-service | SonarQube token for task project |
| `SONAR_TOKEN_ANALYSIS` | ci-analysis-service | SonarQube token for analysis project |
| `SONAR_TOKEN_GATEWAY` | ci-gateway | SonarQube token for gateway project |
| `SONAR_TOKEN_FRONTEND` | ci-frontend | SonarQube token for frontend project |
| `SONAR_HOST_URL` | All CI | URL to the self-hosted SonarQube server |
| `SNYK_TOKEN` | All CI | Snyk API token for SCA |
| `MAIL_USERNAME` | All CI | SMTP sender address |
| `MAIL_PASSWORD` | All CI | SMTP app password |
| `DEVELOPMENT_TEAM_EMAIL` | All CI | Recipient address for pipeline notifications |
| `GH_PAT` | All CI | Personal Access Token with repo write scope for values.yaml write-back |
