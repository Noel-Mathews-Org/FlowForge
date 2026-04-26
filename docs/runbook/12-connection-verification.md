# 12 - Connection Verification

**Parent:** [Runbook Index](./00-index.md)

---

## 12.1 Purpose

This document provides a series of ordered verification checks to confirm that all components of the FlowForge platform are connected and healthy. Run these checks in sequence after any deployment, infrastructure change, or incident.

---

## 12.2 Argo CD Application Health

Verify all three Argo CD Applications are in a `Healthy` and `Synced` state.

```bash
kubectl get applications -n argocd
```

Expected output:

```
NAME              SYNC STATUS   HEALTH STATUS
flowforge-dev     Synced        Healthy
flowforge-prod    Synced        Healthy
flowforge-infra   Synced        Healthy
```

If an Application shows `OutOfSync`, inspect the diff:

```bash
kubectl describe application flowforge-dev -n argocd
```

---

## 12.3 Pod Health in Dev and Prod

```bash
kubectl get pods -n dev
kubectl get pods -n prod
```

All pods should be in `Running` state with `READY` showing the correct ratio (e.g., `1/1`).

```bash
# Check Rollout status for each service
kubectl argo rollouts get rollout flowforge-dev-auth-service -n dev
kubectl argo rollouts get rollout flowforge-dev-frontend -n dev
```

Rollouts should show status `Healthy` with no pods in `Degraded` or `Paused` state unless a deployment is actively in progress.

---

## 12.4 PostgreSQL Connectivity

Verify PostgreSQL is running and accepting connections from within the dev namespace.

```bash
kubectl exec -n dev statefulset/postgres -- \
  psql -U postgres -c "\l"
```

Expected: A list of databases including `auth_db`, `project_db`, `task_db`, `analytics_db`.

If the exec fails, check the StatefulSet and PVC status:

```bash
kubectl get statefulset postgres -n dev
kubectl get pvc -n dev
```

---

## 12.5 Redis Connectivity

Verify Redis is running and responding.

```bash
kubectl exec -n dev statefulset/redis -- redis-cli ping
```

Expected output: `PONG`

---

## 12.6 Service DNS Resolution

Verify that Kubernetes internal DNS resolves service names correctly from within a pod.

```bash
# Run a temporary debug pod in the dev namespace
kubectl run dns-test --image=busybox --restart=Never -n dev -- \
  nslookup auth-service.dev.svc.cluster.local

# Clean up
kubectl delete pod dns-test -n dev
```

Expected: DNS returns the ClusterIP of the `auth-service` Service.

---

## 12.7 Network Policy Verification

Verify that the `tier: backend` pods cannot reach the internet (except on SMTP ports).

```bash
# Get the name of a running backend pod
kubectl get pods -n dev -l tier=backend

# Try to curl an external address (should fail or timeout)
kubectl exec -n dev <pod-name> -- curl --max-time 5 https://google.com
```

Expected: Connection refused or timeout. If the request succeeds on a non-SMTP port, the network policy is not being enforced correctly.

---

## 12.8 HAProxy Backend Health

SSH into the HAProxy EC2 instance and check backend health via the stats socket.

```bash
echo "show stat" | sudo socat stdio /run/haproxy/admin.sock | \
  cut -d ',' -f 1,2,18 | grep -E "BACKEND|flowforge"
```

All backends should show `UP` status. `DOWN` indicates the NodePort is unreachable.

---

## 12.9 kgateway Envoy Pod Health

```bash
kubectl get pods -n kgateway-system
```

All Envoy proxy pods should be in `Running` state. If an Envoy pod is in `CrashLoopBackOff`, the Gateway API routing will not function and no traffic will reach the application.

---

## 12.10 Sealed Secrets Controller Health

Verify the Sealed Secrets controller is running and has decrypted the application secrets.

```bash
# Check the controller pod
kubectl get pods -n kube-system | grep sealed-secrets

# Verify the decrypted secret exists in the namespace
kubectl get secret flowforge-secret -n dev
kubectl get secret flowforge-secret -n prod
```

If the `flowforge-secret` does not exist, the controller has not yet decrypted it. Check the controller logs:

```bash
kubectl logs -n kube-system -l name=sealed-secrets-controller
```

---

## 12.11 Kyverno Policy Health

Verify Kyverno is enforcing policies correctly.

```bash
# List cluster policies
kubectl get clusterpolicy

# Expected:
# NAME                  BACKGROUND   VALIDATE ACTION   READY
# disallow-latest-tag   true         Enforce           True

# Verify policy is blocking latest tag (expected to fail):
kubectl run test-pod --image=nginx:latest -n dev
```

Expected: Admission is rejected with the message: `Using a mutable image tag e.g. 'latest' is not allowed.`

---

## 12.12 End-to-End Application Check

Perform a full end-to-end health check using curl against the live domain.

```bash
# Check that the production domain returns HTTP 200
curl -I https://flowforge.fun

# Check that the API gateway health endpoint responds
curl https://flowforge.fun/api/health

# Check that the preview URL is accessible
curl -I https://preview.flowforge.fun
```

All requests should return HTTP 200. A redirect (301) from the HAProxy HTTP-to-HTTPS rule is expected only on port 80.
