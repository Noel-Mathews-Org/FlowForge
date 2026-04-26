# 06 - Secret Management

**Parent:** [Runbook Index](./00-index.md)

---

## 6.1 The Problem with Traditional Kubernetes Secrets

A standard Kubernetes `Secret` object stores values encoded in Base64. Base64 is not encryption. Anyone with access to the Git repository or the manifest file can decode the value trivially:

```bash
echo "c3VwZXJzZWNyZXQ=" | base64 -d
# Outputs: supersecret
```

If plain Secret manifests were committed to Git, anyone with read access to the repository — including third-party CI runners, contributors, or a compromised account — would have access to database passwords, JWT signing keys, and SMTP credentials. This is a critical security anti-pattern.

---

## 6.2 Solution: Bitnami Sealed Secrets

FlowForge uses **Bitnami Sealed Secrets** to solve this problem. The Sealed Secrets controller runs inside the Kubernetes cluster and holds a private asymmetric key. The public key is used to encrypt secrets before they are committed to Git. Only the controller, running inside the cluster, can decrypt them using the private key.

The result is a `SealedSecret` object that is safe to commit to a public or private Git repository. Even if the repository is compromised, the encrypted values are useless without access to the cluster's private key.

---

## 6.3 How the Encryption Works

```
Developer creates a plain Secret YAML (never committed)
          |
          v
kubeseal (uses cluster's public key)
          |
          v
SealedSecret YAML (safe to commit to Git)
          |
          v
Git Repository --> Argo CD --> Cluster
          |
          v
Sealed Secrets Controller (uses cluster's private key)
          |
          v
Plain Kubernetes Secret (exists only inside the cluster, never in Git)
          |
          v
Pod's environment variables (injected via secretRef)
```

---

## 6.4 Secrets Managed in FlowForge

Each namespace (`dev` and `prod`) has its own independent `SealedSecret` with independently encrypted values. The same plaintext password encrypted for the `dev` namespace cannot be decrypted in the `prod` namespace, and vice versa. This is enforced by namespace-scoping at the encryption level.

**Secret name:** `flowforge-secret`

| Key | Purpose |
|:---|:---|
| `DATABASE_PASSWORD` | PostgreSQL superuser password |
| `JWT_SECRET` | HMAC signing key for JSON Web Tokens |
| `SMTP_PASSWORD` | Gmail app password for transactional email |

**Sealed Secret manifests:**
- Dev: `Helm/templates/flowforge-dev-sealed.yaml`
- Prod: `Helm/templates/flowforge-prod-sealed.yaml`

These files use a Helm conditional to ensure each namespace only applies its own sealed secret:

```yaml
{{- if eq .Release.Namespace "dev" }}
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
...
{{- end }}
```

---

## 6.5 How Secrets are Injected into Pods

All pods consume secrets via `envFrom` using the `secretRef` directive. This injects all keys from the `flowforge-secret` as environment variables into the container at startup.

```yaml
envFrom:
  - configMapRef:
      name: flowforge-config
  - secretRef:
      name: flowforge-secret
```

The `DATABASE_URL` is constructed dynamically inside the pod using a secret key reference:

```yaml
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: flowforge-secret
        key: DATABASE_PASSWORD
  - name: DATABASE_URL
    value: "postgresql+asyncpg://postgres:$(DB_PASSWORD)@postgres.dev.svc.cluster.local:5432/auth_db"
```

This avoids putting the full connection string with credentials directly in the `ConfigMap`.

---

## 6.6 Non-Sensitive Configuration: ConfigMap

Non-sensitive configuration values are stored in a `ConfigMap` named `flowforge-config`. This object is stored in plain text in `Helm/templates/global-config.yaml` and is safe to commit.

```yaml
data:
  AUTH_SERVICE_URL: "http://auth-service:80"
  PROJECT_SERVICE_URL: "http://project-service:80"
  TASK_SERVICE_URL: "http://task-service:80"
  ANALYSIS_SERVICE_URL: "http://analysis-service:80"
  RATE_LIMIT_WINDOW_SECONDS: "60"
  SMTP_HOST: "smtp.gmail.com"
  SMTP_PORT: "587"
  SMTP_USERNAME: "bloodymaryy77@gmail.com"
  SMTP_FROM_NAME: "FlowForge"
  APP_PORT: "80"
```

---

## 6.7 Environment Files are Untracked

The `.gitignore` file at the repository root explicitly excludes SSL certificate environment files:

```
*.pem.env
```

No `.env` files exist in the repository. All application configuration flows through Kubernetes ConfigMaps and SealedSecrets. Developers running services locally must create their own `.env` files from a shared template, which is documented separately.

---

## 6.8 Secret Rotation Procedure

To rotate a secret (for example, a compromised `DATABASE_PASSWORD`):

1. Generate a new password value.
2. Update the database user's password in PostgreSQL:
   ```bash
   kubectl exec -n prod statefulset/postgres -- \
     psql -U postgres -c "ALTER USER postgres PASSWORD 'new_password';"
   ```
3. Create a new plain secret manifest locally (never commit this file):
   ```bash
   kubectl create secret generic flowforge-secret \
     --from-literal=DATABASE_PASSWORD='new_password' \
     --from-literal=JWT_SECRET='<existing_value>' \
     --from-literal=SMTP_PASSWORD='<existing_value>' \
     --dry-run=client -o yaml -n prod > temp-secret.yaml
   ```
4. Re-seal for the `prod` namespace:
   ```bash
   kubeseal --namespace prod --format yaml < temp-secret.yaml > sealed.yaml
   ```
5. Copy the `encryptedData` fields from `sealed.yaml` into `Helm/templates/flowforge-prod-sealed.yaml`.
6. Delete `temp-secret.yaml` immediately.
7. Commit and push the updated sealed secret file to the appropriate branch.
8. Argo CD applies the new SealedSecret. The Sealed Secrets controller decrypts and updates the live `flowforge-secret` in the `prod` namespace.
9. Restart all pods to pick up the new environment variable:
   ```bash
   kubectl argo rollouts restart flowforge-prod-auth-service -n prod
   kubectl argo rollouts restart flowforge-prod-project-service -n prod
   kubectl argo rollouts restart flowforge-prod-task-service -n prod
   kubectl argo rollouts restart flowforge-prod-analysis-service -n prod
   kubectl argo rollouts restart flowforge-prod-gateway -n prod
   ```
