# 04 - Branching and Promotion Strategy

**Parent:** [Runbook Index](./00-index.md)

---

## 4.1 Branch Model

FlowForge uses a two-branch permanent model. There are no ephemeral feature branches that merge directly to production. Every change flows through a mandatory staging environment before it can be released.

| Branch | Maps To | Sync Policy |
|:---|:---|:---|
| `test` | `dev` namespace | Argo CD auto-syncs on every commit |
| `prod` | `prod` namespace | Argo CD auto-syncs, but Argo Rollouts pauses at 50% |

---

## 4.2 Developer Workflow: Pushing a Change to Dev

The following is the complete, ordered sequence of events that occurs when a developer pushes a code change. Every step is either automated or explicitly governed.

**Step 1: Developer makes a code change locally.**

The developer modifies source files within one of the service directories, for example `auth-service/routes/auth.py`.

**Step 2: Developer commits and pushes to the `test` branch.**

```bash
git add auth-service/
git commit -m "feat(auth): add refresh token rotation"
git push origin test
```

**Step 3: GitHub Actions detects the push.**

The path filter in `ci-auth-service.yml` matches `auth-service/**`. The caller workflow fires and invokes `_ci-reusable.yml` with `service_name: auth-service`.

**Step 4: SonarQube SAST scan runs.**

The SonarQube scanner analyzes the `auth-service/` directory. Results are pushed to `sonar.flowforge.fun`. The quality gate result is checked.

**Step 5: Snyk SCA scan runs.**

Snyk reads `auth-service/requirements.txt` and reports on known CVEs in dependencies.

**Step 6: Docker image is built locally on the runner.**

```
Image: ghcr.io/noel-mathews-org/flowforge/auth-service:a97a9b2
```
The short SHA `a97a9b2` is derived from the Git commit that triggered this run.

**Step 7: Trivy scans the locally built image.**

Trivy reports any CRITICAL or HIGH vulnerabilities found in the image layers.

**Step 8: Image is pushed to GHCR.**

The scanned and tagged image is pushed to the private GitHub Container Registry.

**Step 9: The pipeline writes back to `values-dev.yaml`.**

```yaml
# Before (Helm/values-dev.yaml)
auth-service:
  image:
    tag: e88633b

# After
auth-service:
  image:
    tag: a97a9b2
```

This commit is pushed to the `test` branch by the pipeline bot account.

**Step 10: Argo CD detects the new commit.**

Argo CD polls or receives a webhook from GitHub. It computes a diff between the live cluster state and the desired state in the `test` branch. It finds that the `auth-service` Rollout is using image tag `e88633b` but the desired state says `a97a9b2`.

**Step 11: Argo CD initiates a sync.**

Argo CD applies the updated Rollout manifest to the `dev` namespace. Because the auth-service uses a **Canary strategy**, Argo Rollouts creates new pods with the new image but pauses at 50% traffic weight. At this point, 1 pod runs the old image and 1 pod runs the new image.

**Step 12: Engineer manually promotes the canary in dev.**

The engineer verifies the new version is healthy in the Argo Rollouts dashboard at `rollouts.flowforge.fun` or via the CLI:

```bash
kubectl argo rollouts promote flowforge-dev-auth-service -n dev
```

After promotion, all pods in dev are updated to the new image.

**Step 13: Notification email is sent to the development team.**

The email contains the pipeline status, commit details, and a link to the Actions run log.

---

## 4.3 Promotion Workflow: Pushing a Change to Production

Production releases are fully governed. A developer cannot push directly to the `prod` branch. The production pipeline is triggered only by a published GitHub Release.

**Step 1: Engineer creates a GitHub Release.**

From the GitHub UI, the engineer creates a new release and tags it following the convention:

```
<service-name>-v<major>.<minor>.<patch>
Example: auth-service-v1.2.0
```

**Step 2: The production release pipeline is triggered.**

`prod-release.yml` starts on the `published` release event.

**Step 3: Pipeline reads the current dev SHA (the governance gate).**

The pipeline checks out the `prod` branch, then fetches and reads `Helm/values-dev.yaml` from the `test` branch to find the exact SHA that is currently running and validated in dev.

```
DEV_SHA = a97a9b2
```

This prevents any image that has not been through the dev pipeline from being promoted to production.

**Step 4: Pipeline pulls the dev SHA image and re-runs Trivy.**

The image `auth-service:a97a9b2` is pulled from GHCR and scanned again with Trivy. This second scan catches any CVEs published since the image was first built.

**Step 5: Image is retagged with the semantic version and pushed.**

```
ghcr.io/noel-mathews-org/flowforge/auth-service:a97a9b2  -->  auth-service:v1.2.0
```

Both tags now exist in GHCR pointing to the same image digest.

**Step 6: Pipeline updates `values-prod.yaml` on the `prod` branch.**

```yaml
auth-service:
  image:
    tag: v1.2.0
```

**Step 7: Argo CD syncs the production namespace.**

Argo CD detects the change on the `prod` branch and applies the updated Rollout. Argo Rollouts starts a **Canary deployment** in the `prod` namespace, sending 50% of traffic to the new version.

**Step 8: Engineer manually inspects and promotes production.**

The engineer verifies health in the Argo Rollouts dashboard, inspects logs, checks Grafana metrics, and then promotes:

```bash
kubectl argo rollouts promote flowforge-prod-auth-service -n prod
```

Traffic shifts 100% to the new version. The old replica set is scaled down after a 30-second delay.

**Step 9: Notification email is sent to the team.**

---

## 4.4 Rollback Procedure

If a problem is detected before manual promotion, the rollback is performed by aborting the Rollout:

```bash
# Abort canary — traffic returns 100% to stable version instantly
kubectl argo rollouts abort flowforge-prod-auth-service -n prod

# The rollout will be in a Degraded state. Restart it to clear:
kubectl argo rollouts retry rollout flowforge-prod-auth-service -n prod
```

If the problem is detected after full promotion, a rollback is performed by reverting the commit to `values-prod.yaml` and creating a new release with the previous stable SHA. Argo CD will auto-sync and Argo Rollouts will canary the rollback.
