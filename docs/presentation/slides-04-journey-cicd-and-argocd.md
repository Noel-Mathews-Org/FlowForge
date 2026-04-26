# Presentation Content — Part 4: Journey (CI/CD Pipeline and Argo CD)

---

## SLIDE 13 — Journey: Building the CI Pipeline

### What We Did

We built a GitHub Actions CI pipeline using a reusable workflow pattern. A single shared workflow file (`_ci-reusable.yml`) contains all the pipeline logic. Six caller workflows, one per service, invoke the shared workflow when a push is detected in that service's directory.

### Why We Did It

Without a CI pipeline, a developer pushing code to the repository has no guarantee that their change is safe. They might introduce a security vulnerability, break an existing API, or include a dependency with a known CVE. By the time a human reviewer notices the problem, the code may already be deployed.

The CI pipeline makes quality and security enforcement automatic and consistent. It runs on every push, the same way, every time. No developer can accidentally skip the Trivy scan or forget to check SonarQube.

Automation also dramatically accelerates delivery. Instead of a developer spending hours building and pushing Docker images manually and then updating server configurations, the entire process from code push to a new image in GHCR takes approximately 3 to 5 minutes.

### Pipeline Stages and Why Each One Exists

**Stage 1 — SonarQube SAST:**
Static Application Security Testing analyzes source code without executing it. It catches injection vulnerabilities, hardcoded secrets, insecure cryptographic functions, and code quality issues at the point where they are cheapest to fix — before any code is built or deployed. SonarQube is self-hosted at `sonar.flowforge.fun` so scan data stays within our infrastructure.

**Stage 2 — SonarQube Quality Gate:**
After the scan completes, the pipeline polls the SonarQube server to retrieve the quality gate result. If the code introduces new security vulnerabilities, new bugs, or drops below quality thresholds, the gate reports a failure. We use `continue-on-error: true` because blocking all development on every minor finding would create a poor developer experience. Instead, the pipeline notifies the team and the finding is reviewed before production promotion.

**Stage 3 — Snyk SCA (Software Composition Analysis):**
While SonarQube analyzes our code, Snyk analyzes our dependencies. A third-party library that we did not write can contain a serious CVE. Snyk reads `requirements.txt` (Python) or `package.json` (Node), checks every package against its vulnerability database, and reports findings above the HIGH severity threshold. Supply chain attacks — where attackers compromise a popular open-source package — are a major real-world threat. SCA is the defense against this category of attack.

**Stage 4 — Docker Build:**
The image is built on the GitHub Actions runner and tagged with the 7-character Git commit SHA. The SHA is deterministic and immutable — it uniquely identifies both the source code commit and the Docker image. This is the foundation of our deployment governance model.

**Stage 5 — Trivy Container Image Scan:**
After the image is built but before it is pushed to GHCR, Trivy scans it for OS-level and language-level vulnerabilities in the image layers. This is a second layer of defense on top of Snyk — it catches vulnerabilities that exist in the base image (e.g., a CVE in an Alpine Linux package) that Snyk would not see by looking at the application's dependency files alone.

**Stage 6 — Push to GHCR:**
Only after completing all scans does the pipeline push the image to the private GitHub Container Registry. The image is tagged with the short SHA. The registry is private — only authenticated actors with a GitHub token can pull images.

**Stage 7 — values-dev.yaml Write-Back (GitOps Bridge):**
This is the critical step that connects CI to CD. The pipeline opens `Helm/values-dev.yaml` and updates the image tag for the changed service to the new SHA, then commits the file back to the `test` branch. This commit is the trigger for Argo CD to sync the cluster. No manual steps are needed.

**Stage 8 — Email Notification:**
A formatted HTML email is sent to the development team after every pipeline run. The email contains the pipeline status, the commit author, the commit message, the SHA, and a direct link to the GitHub Actions run log. The team always knows what is happening, whether it succeeds or fails.

### Deployment Governance: The SHA Strategy

The SHA strategy is a key governance mechanism. When a developer pushes code, the pipeline computes the image tag from the Git commit SHA — a value that is mathematically derived from the exact state of the source code. It is impossible to produce the same SHA from different code. Therefore:

- Every image in GHCR maps to exactly one commit in Git.
- Every entry in `values-dev.yaml` or `values-prod.yaml` maps to exactly one image.
- The entire audit trail — who changed what, when, and what image it produced — is traceable in the Git history.

No one can push an arbitrary or unverified image to the cluster. The cluster only ever runs images produced by the pipeline from code that exists in the repository.

### Issues Faced and How We Resolved Them

**Issue 1 — Git push conflicts on values-dev.yaml:**
Multiple services could trigger CI simultaneously, causing two pipeline runs to both try to commit to `values-dev.yaml` at the same time, resulting in a push conflict.
**Resolution:** Added `git pull --rebase origin test` before the `yq` edit step. This pulls the latest state of the file, applies the edit on top, and pushes. In the rare case of a conflict, the pipeline retries cleanly.

**Issue 2 — yq command not found in the runner:**
The initial pipeline used `yq` to edit YAML in-place, but the GitHub Actions Ubuntu runner does not include `yq` by default.
**Resolution:** Used `npx yq` which downloads and runs the tool without a separate installation step.

**Issue 3 — SonarQube quality gate timing out:**
The `sonarsource/sonarqube-quality-gate-action` timed out on large analyses because the SonarQube server was still processing the results.
**Resolution:** Set `timeout-minutes: 5` on the quality gate step to allow more time for the server to complete the analysis computation.

---

## SLIDE 14 — Journey: Setting Up Argo CD and GitOps Continuous Delivery

### What We Did

We installed Argo CD on the Kubernetes cluster and defined three Application resources that continuously synchronize the cluster state with the Git repository. We configured Argo CD to watch the `Helm/` directory on the `test` branch for dev deployments and the `Helm/` directory on the `prod` branch for production deployments.

### Why We Did It

Argo CD is a GitOps controller. GitOps means that Git is the single source of truth for what should be running in the cluster. Any change to the cluster must go through Git. An engineer cannot SSH into a node and modify a running deployment — Argo CD would immediately detect the drift and revert it to the Git-defined state.

This provides three critical guarantees:

1. **Auditability:** Every change to the cluster is a Git commit with an author, a timestamp, and a message. The full history of every deployment is in the Git log.
2. **Consistency:** The dev and prod namespaces always match exactly what is described in `values-dev.yaml` and `values-prod.yaml`. Drift is impossible.
3. **Self-healing:** If a human accidentally deletes a pod or modifies a resource in the cluster, Argo CD detects the divergence and restores the desired state within seconds.

### How We Prevented Wrong Images from Reaching Wrong Namespaces

This was a critical design requirement. The Helm chart contains templates that are rendered differently per namespace using `.Release.Namespace`. The `values-dev.yaml` file contains the dev image SHAs. The `values-prod.yaml` file contains the prod semver tags.

The two Argo CD Application resources point to different branches:
- `flowforge-dev` watches the `test` branch and deploys with `values-dev.yaml`
- `flowforge-prod` watches the `prod` branch and deploys with `values-prod.yaml`

Because the CI pipeline only ever writes to `values-dev.yaml` on the `test` branch, and the production release pipeline only ever writes to `values-prod.yaml` on the `prod` branch, it is structurally impossible for a dev SHA to be applied to the prod namespace or vice versa. The separation is enforced by Git branch access controls and pipeline structure, not by manual discipline.

**The SealedSecret namespace binding adds a second guarantee:** The dev SealedSecret is encrypted and bound to the `dev` namespace. If someone copied the `flowforge-dev-sealed.yaml` content into the `prod` namespace, the Sealed Secrets controller would reject the decryption request — the ciphertext is cryptographically bound to a specific namespace.

### Manual Promotion Gates

After Argo CD syncs a new image to the cluster, Argo Rollouts pauses at the Canary or Blue-Green step and waits for a human to issue a promote command. This is intentional and critical.

**Why manual gates exist:**

An automated pipeline is fast, but it cannot validate business logic, visual appearance, or integration correctness. A readiness probe passing does not mean the new API version returns the correct data. A human engineer must look at the application, test critical paths, and make a judgment call before 100% of traffic shifts.

The manual gate also creates an observable pause. During this pause, Grafana dashboards show whether error rates are elevated on the canary pods, Prometheus metrics show latency distribution, and the Argo Rollouts dashboard shows the current traffic split. All the evidence is available for an informed decision.

**Production release gate:**

The production release pipeline is triggered only by a published GitHub Release. Publishing a release is a deliberate human action. It cannot happen accidentally from a code push. The release tag format (`auth-service-v1.2.0`) is parsed by the pipeline — an incorrectly formatted tag causes the pipeline to exit with an error before any production change is made.

After the pipeline updates `values-prod.yaml`, Argo CD syncs and Argo Rollouts pauses at 50% Canary weight in production. The engineer must explicitly run `kubectl argo rollouts promote` to complete the deployment. No automatic promotion exists in production.

### Issues Faced and How We Resolved Them

**Issue 1 — Argo CD treating missing Rollout CRD as a sync error:**
On initial cluster setup, Argo CD tried to apply Rollout manifests before the Argo Rollouts CRDs were installed, producing a "no matches for kind Rollout" error.
**Resolution:** Installed the Argo Rollouts controller and its CRDs before applying the Argo CD Application definitions.

**Issue 2 — `selfHeal: true` reverting manual test changes:**
During testing, manually scaling a deployment to 0 for troubleshooting was immediately reverted by Argo CD's self-heal mechanism.
**Resolution:** For troubleshooting, the Argo CD Application sync is temporarily suspended via the UI or CLI (`argocd app set flowforge-dev --sync-policy none`), changes are made, and sync is re-enabled after the investigation.

**Issue 3 — `prune: true` deleting manually created debug resources:**
Debug pods created directly with `kubectl run` in the `dev` namespace were deleted by Argo CD's prune operation during the next sync.
**Resolution:** This is expected and correct behavior. For temporary debugging, the `test` namespace (outside Argo CD's scope) is used.
