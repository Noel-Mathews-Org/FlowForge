# 08 - Network Architecture and Routing

**Parent:** [Runbook Index](./00-index.md)

---

## 8.1 Two-Layer Routing Architecture

FlowForge uses two independent routing layers. Understanding their separation is critical to understanding how any request flows through the system.

**Layer 1: HAProxy (Edge)**
Runs on a dedicated EC2 instance at `10.0.1.27`. Responsible for SSL/TLS termination, subdomain-based routing, and basic authentication for protected dashboards. HAProxy does not know about Kubernetes pods or services — it only knows about NodePort addresses.

**Layer 2: kgateway (Internal)**
Runs as Envoy proxy pods inside the Kubernetes cluster. Implements the Kubernetes Gateway API. Responsible for routing traffic from a NodePort entry point to the correct service within a specific namespace. There is one Gateway instance per application namespace and one shared Gateway instance for all dashboards.

---

## 8.2 Complete Traffic Flow: Application Request

**Example: User visits `flowforge.fun` and logs in**

1. User's browser sends an HTTPS request to `flowforge.fun`.
2. DNS resolves `flowforge.fun` to the public IP of the HAProxy EC2 instance.
3. HAProxy receives the request on port 443, terminates the TLS connection using the certificate at `/etc/ssl/private/flowforge.fun.pem`.
4. HAProxy matches the Host header `flowforge.fun` against the ACL `host_prod` and routes to the `flowforge_prod` backend:
   ```
   server prod_node 10.0.1.155:30605 check
   ```
5. The request arrives at NodePort `30605` on the Master Node. Kubernetes kube-proxy forwards this to one of the Envoy (kgateway) pods.
6. The Envoy pod matches the incoming request against the `flowforge-routes` HTTPRoute in the `prod` namespace.
7. The path `/api/auth/login` matches the `/api` prefix rule. Traffic is forwarded to the `gateway` Service on port 80.
8. The `gateway` Service load-balances the request across the two FastAPI Gateway pods.
9. The Gateway pod reads the JWT token, applies rate-limiting against Redis, validates the request, and forwards it to `http://auth-service:80`.
10. The `auth-service` Service delivers the request to one of the two auth-service pods.
11. The auth-service pod queries PostgreSQL at `postgres.prod.svc.cluster.local:5432` and returns the response.

---

## 8.3 Complete Traffic Flow: Preview URL

**Example: Engineer visits `preview.flowforge.fun` to check a new UI**

1. HAProxy matches `preview.flowforge.fun` against the `host_preview` ACL.
2. Traffic is sent to the same `flowforge_prod` backend at NodePort `30605` (same NodePort as production).
3. The Envoy pod receives the request but matches it against the `flowforge-preview-routes` HTTPRoute, which is attached to the `http-preview` listener configured for the `preview.flowforge.fun` hostname.
4. The path `/` rule in the preview route matches and routes traffic to the `frontend-preview` Service.
5. The `frontend-preview` Service delivers the request to the Green pod with the new image — without any production traffic being affected.

---

## 8.4 Complete Traffic Flow: Dashboard Request

**Example: Engineer visits `argocd.flowforge.fun`**

1. HAProxy matches `argocd.flowforge.fun` against `host_argocd`.
2. No basic authentication is required for ArgoCD (only `prometheus.flowforge.fun` and `rollouts.flowforge.fun` are password-protected).
3. HAProxy routes to the `kgateway_back` backend, which load-balances across all three worker nodes on port `30639`:
   ```
   server worker1 10.0.1.102:30639 check
   server worker2 10.0.1.245:30639 check
   server worker3 10.0.1.85:30639 check
   ```
4. The request arrives at NodePort `30639` and is delivered to the central `dashboard-gateway` Envoy pod in the `gateway` namespace.
5. The `dashboard-gateway` is configured with `allowedRoutes.namespaces.from: All`, meaning it accepts HTTPRoute registrations from any namespace.
6. A `ReferenceGrant` in the `gateway` namespace explicitly allows HTTPRoute resources in the `argocd`, `monitoring`, `argo-rollouts`, `keycloak`, `logging`, and `kube-system` namespaces to attach to the `dashboard-gateway`.
7. The `argocd-route` HTTPRoute in the `argocd` namespace matches the hostname `argocd.flowforge.fun` and forwards traffic to the `argocd-server` service on port 80.

---

## 8.5 Namespace Network Isolation

The `dev` and `prod` namespaces are isolated at the Kubernetes networking layer. A pod in `dev` cannot initiate a connection to a pod in `prod`, and vice versa. This isolation is enforced by:

1. **Separate Service DNS:** The `auth-service` in `dev` is resolved as `auth-service.dev.svc.cluster.local`. The same service in `prod` resolves as `auth-service.prod.svc.cluster.local`. A pod using only the short name `auth-service` will resolve within its own namespace.

2. **Separate Gateway Instances:** The `flowforge-gateway` in `dev` accepts traffic only from routes in the `dev` namespace (`allowedRoutes.namespaces.from: Same`). A route in `prod` cannot attach to the `dev` gateway.

3. **Network Policies:** All network policies are scoped to a specific namespace via `metadata.namespace`. A policy in the `dev` namespace does not affect pods in the `prod` namespace.

---

## 8.6 Network Policies (Zero-Trust Between Tiers)

All network policies are defined in `Helm/templates/network-policies.yaml`. They are Helm-templated and therefore deployed independently into the `dev` and `prod` namespaces.

Pods are classified by the label `tier`. Each rollout assigns a tier label:
- `tier: gateway` — FastAPI API Gateway
- `tier: frontend` — Next.js frontend
- `tier: backend` — All microservices (auth, project, task, analysis)
- `tier: data` — PostgreSQL and Redis StatefulSets

### Policy 1: allow-kgateway-to-gateway

**Targets:** Pods with label `tier: gateway`

Ingress allowed from:
- Any pod in the same namespace (`podSelector: {}` — permits the local Envoy proxy)
- Any external IP block (`0.0.0.0/0` — permits health checks from HAProxy)

Egress allowed to:
- `kube-system` namespace on UDP/TCP port 53 (DNS resolution)
- ClusterIP range `10.96.0.0/12` (internal Kubernetes services)
- Pods labeled `tier: backend`
- Pods labeled `tier: frontend`
- Pods labeled `tier: data` (Redis for rate limiting)

### Policy 2: allow-gateway-to-backend

**Targets:** Pods with label `tier: backend`

Ingress allowed from:
- Pods labeled `tier: gateway` only
- Other pods labeled `tier: backend` (for service-to-service calls)

Egress allowed to:
- DNS in `kube-system`
- Pods labeled `tier: backend`
- Pods labeled `tier: data` (PostgreSQL and Redis)
- External internet on TCP ports 587 and 465 (SMTP for email sending)

**What this blocks:** The frontend pod cannot directly reach a microservice. If the frontend is compromised, the attacker cannot call the auth or project APIs directly. All traffic must route through the Gateway.

### Policy 3: allow-backend-to-data

**Targets:** Pods with label `tier: data`

Ingress allowed from:
- Pods labeled `tier: backend`
- Pods labeled `tier: gateway` (for Redis rate limiting)

Egress allowed to:
- DNS in `kube-system`
- ClusterIP range `10.96.0.0/12`

**What this blocks:** The data tier has no egress to the internet. A compromised database pod cannot exfiltrate data to an external server.

### Policy 4: allow-external-to-frontend

**Targets:** Pods with label `tier: frontend`

Ingress allowed from:
- Pods in the `kgateway-system` namespace (the Envoy proxy)
- Open ingress (`{}`) for direct access via the Gateway API

Egress allowed to:
- DNS in `kube-system`
- Pods labeled `tier: gateway`
- ClusterIP range `10.96.0.0/12`

**What this blocks:** The frontend cannot initiate connections to `tier: backend` or `tier: data` directly.

---

## 8.7 HAProxy Security Features

- **HSTS header:** All responses include `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Browsers will refuse to access any FlowForge subdomain over plain HTTP for one year after this header is seen.
- **HTTP to HTTPS redirect:** Port 80 immediately issues a 301 redirect to HTTPS.
- **Basic authentication:** The `monitoring_users` userlist protects `prometheus.flowforge.fun` and `rollouts.flowforge.fun`. Access requires a valid username and password before HAProxy forwards the request.
- **Modern TLS:** Only TLS 1.2 and above is accepted. Legacy protocols are explicitly disabled with `ssl-min-ver TLSv1.2 no-tls-tickets`.
- **Strong cipher suites:** Only ECDHE and DHE cipher suites are permitted.
