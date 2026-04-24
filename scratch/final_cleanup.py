import os

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Fix and Move ArgoCD Apps
apps = {
    "k8s/argocd/dev-app.yaml": """
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: flowforge-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: 'https://github.com/Noel-Mathews-Org/FlowForge.git'
    targetRevision: test
    path: Helm
    helm:
      valueFiles:
        - values-dev.yaml
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
""",
    "k8s/argocd/prod-app.yaml": """
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: flowforge-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: 'https://github.com/Noel-Mathews-Org/FlowForge.git'
    targetRevision: prod
    path: Helm
    helm:
      valueFiles:
        - values-prod.yaml
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
""",
    "k8s/argocd/infra-app.yaml": """
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: flowforge-infra
  namespace: argocd
spec:
  project: default
  source:
    repoURL: 'https://github.com/Noel-Mathews-Org/FlowForge.git'
    targetRevision: test
    path: k8s/dashboards
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: gateway
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
"""
}

for path, content in apps.items():
    write_file(path, content)

# 2. Fix Helm Base Repositories to point to GHCR
services = ["auth-service", "gateway", "frontend", "project-service", "task-service", "analysis-service"]
for svc in services:
    path = f"Helm/charts/{svc}/values.yaml"
    if os.path.exists(path):
        with open(path, "r") as f:
            lines = f.readlines()
        with open(path, "w") as f:
            for line in lines:
                if "repository:" in line:
                    f.write(f"  repository: ghcr.io/noel-mathews-org/flowforge/{svc}\n")
                else:
                    f.write(line)

print("Moved ArgoCD apps to k8s/argocd/, removed CreateNamespace, and updated Helm repos to GHCR.")
