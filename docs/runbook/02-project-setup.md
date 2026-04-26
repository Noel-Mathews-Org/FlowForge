# 02 - Project Setup

**Parent:** [Runbook Index](./00-index.md)

---

## 2.1 Repository Structure

The FlowForge monorepo is organized so that each service is a self-contained directory at the root. The `Helm` folder contains the single parent Helm chart that deploys the entire application. The `infra` folder contains cluster-level manifests that are managed by a separate Argo CD Application.

```
FlowForge/
├── .github/
│   └── workflows/               # GitHub Actions CI workflows
│       ├── _ci-reusable.yml     # Shared pipeline logic for all services
│       ├── ci-auth-service.yml
│       ├── ci-frontend.yml
│       ├── ci-gateway.yml
│       ├── ci-project-service.yml
│       ├── ci-task-service.yml
│       ├── ci-analysis-service.yml
│       └── prod-release.yml     # Production release pipeline
├── Helm/
│   ├── Chart.yaml
│   ├── values-dev.yaml          # Dev image tags and config
│   ├── values-prod.yaml         # Prod image tags and config
│   ├── templates/               # Shared cluster resources (DB, secrets, network)
│   └── charts/                  # Per-service sub-charts
│       ├── auth-service/
│       ├── frontend/
│       ├── gateway/
│       ├── project-service/
│       ├── task-service/
│       └── analysis-service/
├── infra/
│   ├── argocd/                  # Argo CD Application definitions
│   ├── infrastructure/          # Dashboard gateway, monitoring routes
│   └── kyverno-policies/        # Cluster-wide admission policies
├── auth-service/                # Python FastAPI microservice
├── project-service/
├── task-service/
├── analysis-service/
├── gateway/                     # Python FastAPI API Gateway
├── frontend/                    # Next.js 14 React application
└── k8s-manifest/                # Raw rendered Kubernetes manifests (reference)
```

---

## 2.2 Prerequisites for Cluster Bootstrap

The following tools and controllers must be installed on the Kubernetes cluster before any application can be deployed. These are one-time setup tasks.

| Component | Install Method | Purpose |
|:---|:---|:---|
| Argo CD | `kubectl apply -n argocd` | GitOps controller |
| Argo Rollouts | Helm or `kubectl apply` | Blue-Green and Canary engine |
| kgateway (Envoy) | Helm | Kubernetes Gateway API implementation |
| Bitnami Sealed Secrets Controller | Helm | Decrypts SealedSecrets in the cluster |
| Kyverno | Helm | Admission controller for policy enforcement |
| NFS CSI Driver | Helm | Dynamic NFS volume provisioning |
| Prometheus Stack | Helm (kube-prometheus-stack) | Monitoring and alerting |
| Metrics Server | Helm or manifest | Required for HPA CPU metrics |

---

## 2.3 Sealing Secrets Before First Deployment

Before deploying, all application secrets must be encrypted using the Sealed Secrets controller's public key. Plain `Secret` objects must never be committed to Git.

**Process to create or rotate a sealed secret:**

```bash
# 1. Create a plain secret manifest (NEVER commit this file)
kubectl create secret generic flowforge-secret \
  --from-literal=DATABASE_PASSWORD='<value>' \
  --from-literal=JWT_SECRET='<value>' \
  --from-literal=SMTP_PASSWORD='<value>' \
  --dry-run=client -o yaml > plain-secret.yaml

# 2. Seal it using the controller's public key
kubeseal --controller-name=sealed-secrets \
  --controller-namespace=kube-system \
  --format=yaml < plain-secret.yaml > sealed-secret.yaml

# 3. Discard the plain secret immediately
rm plain-secret.yaml

# 4. The sealed secret for each namespace is already embedded in
#    Helm/templates/flowforge-dev-sealed.yaml and
#    Helm/templates/flowforge-prod-sealed.yaml
#    Update those files with the new encrypted values.
```

---

## 2.4 Bootstrapping Argo CD Applications

Once Argo CD is installed, the three Application resources must be applied manually once. After that, Argo CD manages everything automatically.

```bash
# Apply the Argo CD Application definitions
kubectl apply -f infra/argocd/dev-app.yaml
kubectl apply -f infra/argocd/prod-app.yaml
kubectl apply -f infra/argocd/infra-app.yaml
```

Argo CD will immediately begin watching the repository and deploy the defined resources into the target namespaces. From this point, every change to the Helm values or templates in the tracked branch is automatically applied to the cluster.

---

## 2.5 Applying Cluster-Level Resources

Kyverno policies and the NFS StorageClass are not managed by the application Helm chart. They must be applied once at cluster bootstrap.

```bash
# Apply the Kyverno admission policy
kubectl apply -f infra/kyverno-policies/cluster-policies.yaml

# Apply the NFS StorageClass
kubectl apply -f k8s-manifest/storageclass.yaml
```
