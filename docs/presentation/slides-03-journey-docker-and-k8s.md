# Presentation Content — Part 3: Journey (Docker, Compose, K8s Manifests)

---

## SLIDE 10 — Journey: Dockerizing the Application

### What We Did

We created individual Dockerfiles for all six services: auth-service, project-service, task-service, analysis-service, gateway, and the Next.js frontend.

### Why We Did It

Containers solve the "it works on my machine" problem permanently. A Docker image packages the application code, its runtime, and all its dependencies into a single, immutable, portable artifact. The same image runs identically on a developer's laptop, in a CI runner, in the dev Kubernetes namespace, and in production. There is no configuration drift between environments.

### How We Did It — Security Steps Taken

**Multi-Stage Builds:**
Every Dockerfile uses a multi-stage build pattern. The first stage (builder) installs dependencies and compiles the application. The second stage (runner) starts from a fresh minimal base image and copies only the final artifacts. Build tools, package caches, and intermediate files never appear in the final image.

```dockerfile
# Python service example
FROM python:3.11-slim AS builder
RUN pip install --prefix=/install -r requirements.txt

FROM python:3.11-slim AS runner
COPY --from=builder /install /usr/local
```

**Non-Root User:**
Every service Dockerfile creates a dedicated system user (`stuser`) and switches to it before the CMD instruction. The application process inside the container never runs as root. If a vulnerability in the application is exploited, the attacker lands in a restricted, non-root shell.

```dockerfile
RUN addgroup --system stgroup && adduser --system --group stuser
COPY --chown=stuser:stgroup . .
USER stuser
```

**Minimal Base Images:**
- Python services use `python:3.11-slim` — the official slim variant without unnecessary OS packages.
- Frontend uses `node:18-alpine` — Alpine Linux is under 8MB and has a dramatically smaller attack surface than Debian-based images.
- Database uses `postgres:16-alpine` and cache uses `redis:7-alpine`.

**Next.js Standalone Mode:**
The frontend Dockerfile uses Next.js's standalone output. The final image does not contain `node_modules` or build tooling. It contains only the compiled JavaScript bundle and the Node.js runtime. This reduces the frontend image size by over 60%.

**Explicit EXPOSE:**
Each Dockerfile declares the correct port with `EXPOSE`. This is documentation for operators and required by some container orchestration tools to set up networking correctly.

### Issues Faced and How We Resolved Them

**Issue 1 — Large image sizes:**
Initial builds produced images over 800MB for Python services because pip caches and build artifacts were included in the layer.
**Resolution:** Added `--mount=type=cache,target=/root/.cache/pip` to the pip install command and ensured only `/install` was copied to the runner stage.

**Issue 2 — Permission errors at runtime:**
After switching to `stuser`, the application failed to write to its working directory.
**Resolution:** Added `COPY --chown=stuser:stgroup . .` to transfer ownership of all application files to the non-root user before the `USER` instruction.

**Issue 3 — Next.js standalone output missing static files:**
The Next.js app built successfully but served 404 for all CSS and JS assets.
**Resolution:** Explicitly copied both `.next/standalone` and `.next/static` directories in the runner stage. Standalone mode does not automatically include the static directory.

---

## SLIDE 11 — Journey: Docker Compose for Local Testing

### What We Did

We created a `docker-compose.yml` file at the root of the repository that starts all six services, PostgreSQL, and Redis together on a single local machine using a shared Docker network.

### Why We Did It

Kubernetes is complex to set up locally. Docker Compose lets the entire team run the complete application stack with a single command (`docker-compose up`) without needing a Kubernetes cluster. It is the fastest way to verify that all services can reach each other, the database seeds correctly, and the routing through the Gateway works before writing any Kubernetes manifests.

### How We Did It

The Compose file defines all services with:
- Environment variables mapped from a `.env` file (which is gitignored)
- A shared `flowforge-network` bridge network so services resolve each other by name
- Health checks for PostgreSQL so dependent services wait until the database is ready
- Named volumes for PostgreSQL data persistence between `docker-compose down` and `docker-compose up` cycles

### Issues Faced and How We Resolved Them

**Issue 1 — Services started before PostgreSQL was ready:**
Auth-service crashed on startup because PostgreSQL was still initializing its data directory.
**Resolution:** Added `depends_on` with `condition: service_healthy` and defined a `healthcheck` on the postgres service using `pg_isready`.

**Issue 2 — Environment variable inconsistencies:**
Different services expected the database URL in slightly different formats (SQLAlchemy async vs sync).
**Resolution:** Standardized all Python services to use `asyncpg` with the `postgresql+asyncpg://` prefix and documented the required format.

**Issue 3 — Port conflicts on developer machines:**
Port 5432 on the developer's machine was already in use by a local PostgreSQL installation.
**Resolution:** Mapped the container port to a non-standard host port (e.g., `5433:5432`) in Compose while keeping internal service communication on the standard port.

---

## SLIDE 12 — Journey: Writing Kubernetes Manifests

### What We Did

After validating the application in Docker Compose, we wrote Kubernetes manifests for the dev environment. We initially wrote raw YAML manifests and later converted them into a Helm chart to support templating for multiple environments (dev and prod).

### Why We Did It

Kubernetes provides the platform for production-grade workloads: automatic pod scheduling, self-healing, horizontal scaling, rolling updates, and service discovery. Docker Compose is for local development only. A production system requires Kubernetes.

Helm was chosen over plain YAML because the application needs to deploy identically to two namespaces (dev and prod) with only the image tags and domain names differing. Helm templates allow a single set of YAML files to be rendered with different values for each environment. Without Helm, we would need to maintain two identical YAML trees that diverge only in a few values, which is error-prone.

### What We Implemented in the Manifests and Why

**Argo Rollouts instead of standard Deployments:**

Standard Kubernetes `Deployment` resources perform rolling updates, which are uncontrolled — old and new pods serve traffic simultaneously in an unpredictable ratio. We replaced all `Deployment` resources with Argo `Rollout` resources, which give us structured traffic control.

- **Frontend uses Blue-Green:** The UI is what users see. A broken UI change should never reach a user without being verified first. Blue-Green keeps the old version fully active while the new version is deployed to a preview endpoint. A human verifies the preview before flipping the switch.
- **Backend services use Canary (50% weight, manual pause):** If a new API version has a bug, only half of requests are affected before the engineer decides to promote or abort. The `pause: {}` step means the Rollout stops at 50% and waits indefinitely for human approval. It never auto-promotes.
- **Why not Rolling Update for everything?** Rolling updates cannot be paused or controlled. If the new version has a bug, traffic immediately hits both old and new pods. There is no preview URL, no safe test environment, and the only recovery is a new deployment.
- **Why not Blue-Green for everything?** Blue-Green requires double the resources — a full second set of pods must exist during the transition. For six microservices running at 2 replicas each, this would require 24 pods simultaneously during a deployment. Canary achieves the same safety guarantee with only one additional pod per service.

**Pod Anti-Affinity:**

Every Rollout defines a `requiredDuringSchedulingIgnoredDuringExecution` anti-affinity rule with `topologyKey: kubernetes.io/hostname`. This forces Kubernetes to schedule the two replicas of any service on different worker nodes. If Worker Node 1 fails, one replica of every service continues running on Worker Node 2. This is true high availability. Without anti-affinity, Kubernetes might schedule both replicas on the same node, making the service completely unavailable if that node fails.

**Liveness and Readiness Probes:**

Both probes make HTTP GET requests to the `/health` endpoint of each service.

- **Readiness Probe** (`initialDelaySeconds: 5`, `periodSeconds: 10`): A pod is not added to the Service endpoints until this probe returns HTTP 200. During a Canary deployment, if the new pod fails its readiness probe, it receives zero traffic. The Rollout stays paused at 0% canary weight, protecting all users.
- **Liveness Probe** (`initialDelaySeconds: 15`, `periodSeconds: 10`): If a running pod's health endpoint stops responding (deadlock, hung process, memory exhaustion), Kubernetes restarts the container automatically. The longer initial delay prevents killing a pod that is still in its normal startup phase.

**StatefulSets for Databases:**

PostgreSQL and Redis are managed as StatefulSets rather than Deployments or Rollouts. StatefulSets provide guaranteed stable network identities (`postgres-0.postgres.dev.svc.cluster.local`) and sticky PVC bindings. The `postgres-0` pod always mounts the `postgres-data-postgres-0` PVC — even after a pod restart or rescheduling to a different node. This is essential for a database.

**HorizontalPodAutoscaler:**

Every service's Rollout has an HPA attached. The HPA targets the Rollout kind directly (not a Deployment) with:
- `minReplicas: 2` — ensures two pods are always running (one per node for anti-affinity compliance)
- `maxReplicas: 4` — caps scaling at four pods to prevent runaway resource consumption
- `targetCPUUtilizationPercentage: 70` — scales up when average CPU exceeds 70%

**Storage — NFS CSI Driver:**

PostgreSQL and Redis use `PersistentVolumeClaims` backed by the `nfs-csi` StorageClass. The NFS CSI driver dynamically provisions volumes on a dedicated NFS EC2 server at `10.0.1.140`. When a StatefulSet pod is rescheduled to another node, the CSI driver re-attaches the NFS volume to the new node. The data survives node failures because it lives on a separate server, not on any worker node's local disk. We chose NFS over node-local storage because our application runs on two nodes and we cannot predict which node a pod will land on. We did not use database replication because our cluster has limited resources and a single well-persisted primary is sufficient for this workload.

**Sealed Secrets instead of plain Kubernetes Secrets:**

Plain Kubernetes Secrets are base64-encoded, not encrypted. Anyone with repository access can decode them. Bitnami Sealed Secrets uses asymmetric encryption — the controller's private key never leaves the cluster, and only the controller can decrypt the sealed values. The sealed secret YAML is safe to commit to a public repository. This is the only correct way to handle secrets in a GitOps workflow.

**Network Policies (Zero-Trust):**

Four NetworkPolicy resources enforce that pods in different tiers cannot communicate with each other unless explicitly permitted:

- Frontend pods can only send egress to the Gateway. They cannot reach databases or microservices directly.
- Backend pods can only receive ingress from the Gateway. They can send egress to the data tier and to SMTP servers (for email).
- Data pods can only receive ingress from backend and gateway pods. They have no internet egress.

### Issues Faced and How We Resolved Them

**Issue 1 — Helm templating collision between dev and prod sealed secrets:**
Both namespaces used the same Helm template file but needed different encrypted values.
**Resolution:** Used a Helm conditional `{{- if eq .Release.Namespace "dev" }}` to include the dev-encrypted sealed secret only when deploying to the `dev` namespace, and the equivalent for `prod`.

**Issue 2 — HPA could not find Rollout resource:**
The HPA `scaleTargetRef` initially pointed to `kind: Deployment`, which caused the HPA to report a "not found" error since we use `kind: Rollout`.
**Resolution:** Updated the HPA manifest to use `apiVersion: argoproj.io/v1alpha1` and `kind: Rollout` in the `scaleTargetRef`.

**Issue 3 — StatefulSet PVC not being recreated after deletion:**
When testing the database wipe procedure, deleting the StatefulSet left the PVC in a bound but unused state, preventing a clean re-initialization.
**Resolution:** The correct wipe sequence is: scale to 0, delete PVC, then delete StatefulSet. Argo CD then recreates the StatefulSet, which triggers a new PVC creation and a fresh PostgreSQL initialization using the initdb ConfigMap.

**Issue 4 — Kyverno blocking dev deployments with `latest` tag:**
During initial cluster setup, Kyverno rejected pods because the initial test deployments used `latest` tags.
**Resolution:** Ensured all pipeline-built images use the Git commit SHA as the tag. Updated all Helm chart `values.yaml` defaults to a real SHA. The `latest` tag is now completely absent from all manifests.
