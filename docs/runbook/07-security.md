# 07 - Security Hardening

**Parent:** [Runbook Index](./00-index.md)

---

## 7.1 Security Strategy Overview

Security in FlowForge is implemented in layers, starting from the point of code writing and continuing through image building, pipeline scanning, admission control, runtime isolation, and network enforcement. Each layer is independent — a failure or bypass of one layer does not compromise the others.

The layers in order are:

1. Source code: SAST via SonarQube
2. Dependencies: SCA via Snyk
3. Container image: Trivy scan pre-push and pre-production
4. Image build: Dockerfile hardening (non-root user, multi-stage)
5. Registry: Private GHCR with SHA-tagged immutable images
6. Admission: Kyverno policy blocks `latest` tag
7. Runtime: Non-root pod security context, automount token disabled
8. Network: Kubernetes NetworkPolicy enforcing zero-trust between tiers
9. Secrets: Bitnami Sealed Secrets — no plaintext in Git
10. DAST: Dynamic application security testing report produced

---

## 7.2 Dockerfile Security Measures

**Multi-stage builds** are used in all service Dockerfiles. This pattern prevents build tools, package managers, and intermediate files from being included in the final runtime image. The attack surface of the final image is minimal.

**Python services (example: auth-service):**

```dockerfile
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements.txt

FROM python:3.11-slim AS runner
WORKDIR /app
COPY --from=builder /install /usr/local
RUN addgroup --system stgroup && adduser --system --group stuser
COPY --chown=stuser:stgroup . .
USER stuser
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Key decisions:
- `python:3.11-slim`: Minimal base image, not `python:3.11` (full), not `python:3.11-alpine` (compatibility issues). Slim reduces image size and OS package attack surface.
- `--mount=type=cache`: Build cache is not baked into a layer. The final image does not contain pip cache or build artifacts.
- `addgroup` / `adduser --system`: A dedicated non-root system user `stuser` is created.
- `USER stuser`: The application process runs as a non-root user. If a vulnerability is exploited in the application, the attacker does not have root access inside the container.
- `COPY --chown=stuser:stgroup`: Application files are owned by `stuser`, not root.

**Frontend (Next.js):**

```dockerfile
FROM node:18-alpine AS deps       # Dependency installation only
FROM node:18-alpine AS builder    # Build step only — node_modules from deps stage
FROM node:18-alpine AS runner     # Production runtime only

RUN addgroup --system --gid 1001 stgroup \
    && adduser --system --uid 1001 --ingroup stgroup stuser
COPY --from=builder --chown=stuser:stgroup /app/.next/standalone ./
USER stuser
CMD ["node", "server.js"]
```

Next.js standalone output mode is used. The final image contains only the compiled application bundle and does not include the full `node_modules` directory or build toolchain.

---

## 7.3 Kyverno Admission Controller

**File:** `infra/kyverno-policies/cluster-policies.yaml`

Kyverno is a Kubernetes-native policy engine that acts as an admission webhook. Every `Pod` creation or update request sent to the Kubernetes API server is intercepted by Kyverno before it is accepted.

Two rules are enforced with `validationFailureAction: Enforce`:

**Rule 1: require-image-tag**

```yaml
validate:
  message: "An image tag is required."
  pattern:
    spec:
      containers:
      - image: "*:*"
```

A pod cannot be created unless every container specifies an image with a tag (the `name:tag` format). An image specified as `ghcr.io/org/service` without a tag is rejected.

**Rule 2: validate-image-tag**

```yaml
validate:
  message: "Using a mutable image tag e.g. 'latest' is not allowed."
  pattern:
    spec:
      containers:
      - image: "!*:latest"
```

A pod cannot be created if any container uses the `latest` tag. This policy enforces immutable image references across the entire cluster. Because the CI pipeline always tags images with the Git commit SHA (e.g., `a97a9b2`) and production images with semantic versions (e.g., `v1.2.0`), all pipeline-generated deployments automatically pass this policy.

The `background: true` setting means Kyverno also audits existing resources, not only new requests.

---

## 7.4 Service Accounts and Token Disabling

Every Rollout in every service specifies a dedicated ServiceAccount:

```yaml
serviceAccountName: flowforge-dev-auth-service
```

The ServiceAccount definition is:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: flowforge-dev-auth-service
  namespace: dev
automountServiceAccountToken: false
```

`automountServiceAccountToken: false` is explicitly set. By default, Kubernetes automatically mounts a service account token into every pod at `/var/run/secrets/kubernetes.io/serviceaccount/token`. This token grants API access to the cluster. FlowForge microservices do not need to talk to the Kubernetes API. Disabling auto-mount removes this credential from the container filesystem entirely, eliminating the risk of it being stolen if the container is compromised.

---

## 7.5 Pod Security Context

All pods run with a non-root security context, defined at the pod spec level in every Rollout:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
```

`runAsNonRoot: true` is a Kubernetes-enforced guarantee. Even if the Dockerfile does not correctly specify `USER`, Kubernetes will reject the pod if the container's process would run as UID 0 (root). `runAsUser: 1001` maps to the `stuser` system user created in the Dockerfile.

---

## 7.6 Static Application Security Testing (SAST)

SonarQube performs SAST on every push to the `test` branch. It analyzes the source code without executing it, looking for:

- Injection vulnerabilities (SQL, command, path traversal)
- Authentication weaknesses (hardcoded credentials, weak token generation)
- Sensitive data exposure patterns
- Insecure cryptographic usage
- Code quality issues that are security-relevant

Each service has its own SonarQube project with a dedicated token. See [11 - Code Quality](./11-code-quality.md) for the full quality gate parameters.

---

## 7.7 Software Composition Analysis (SCA)

Snyk performs SCA by analyzing the dependency manifest of each service against its vulnerability database. It identifies:

- CVEs in third-party libraries with severity ratings
- Known exploitability information
- Fix versions for vulnerable packages

The `--severity-threshold=high` flag limits reporting to HIGH and CRITICAL findings, reducing noise from low-severity informational findings.

---

## 7.8 Container Image Scanning (Trivy)

Trivy runs twice per image in the FlowForge pipeline:

1. **In the dev CI pipeline:** After the Docker image is built on the GitHub Actions runner, before it is pushed to GHCR. This is the primary security gate.
2. **In the production release pipeline:** After the dev SHA image is pulled from GHCR, before it is retagged and pushed to production. This catches newly published CVEs.

Trivy scans:
- OS package vulnerabilities (Alpine apk, Debian apt)
- Language-level library vulnerabilities (Python pip, Node npm)
- Secret leakage in image layers (hardcoded tokens, passwords in ENV)

---

## 7.9 Dynamic Application Security Testing (DAST)

DAST was performed against the running FlowForge application to identify vulnerabilities that only manifest at runtime. Unlike SAST, DAST sends real HTTP requests to the live application and observes responses.

A DAST report has been produced and is available separately. The report covers findings from API endpoint enumeration, authentication bypass attempts, injection testing, and header security analysis.

---

## 7.10 Network-Level Security

See [08 - Network Architecture and Routing](./08-networking.md) for the full network policy documentation. At a summary level, all inter-service communication is restricted by Kubernetes NetworkPolicy objects. No pod can communicate with another pod unless an explicit policy rule permits it. The database tier is completely unreachable from outside the cluster and from the frontend tier.
