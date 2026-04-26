# Presentation Content — Part 5: Journey (DAST, Observability, and Learnings)

---

## SLIDE 15 — Journey: Dynamic Application Security Testing (DAST)

### What We Did

After the application was deployed and running in the dev environment, we performed Dynamic Application Security Testing against the live endpoints. Unlike SAST, which analyzes code statically, DAST sends real HTTP requests to the running application and observes its responses to identify vulnerabilities that only manifest at runtime.

A DAST report has been produced and is available as a separate artifact.

### Why We Did It

Static analysis cannot detect all vulnerability classes. Some vulnerabilities only exist in how the running application behaves:

- Authentication bypass requires an actual login attempt, not code reading.
- Broken access control requires a real request from an unauthorized user to a protected endpoint.
- Security headers (like HSTS, X-Frame-Options, Content-Security-Policy) can only be verified from a live HTTP response.
- Rate limiting effectiveness can only be verified by sending real repeated requests.

DAST provides the runtime validation layer that SAST cannot provide. Together they form complementary defenses.

### What DAST Tests

- Enumeration of all accessible API endpoints
- Authentication and authorization testing (are unauthenticated users blocked?)
- Injection attempts (SQL, command, path traversal in query parameters and request bodies)
- HTTP security header analysis
- Session token security (entropy, expiry, revocability)
- Sensitive data exposure in responses
- Rate limiting enforcement

---

## SLIDE 16 — Journey: Observability — Prometheus, Grafana, and Alertmanager

### What We Did

We deployed a full observability stack in the `monitoring` namespace:
- **Prometheus** scrapes metrics from all pods on a 15-second interval
- **Grafana** provides dashboards for visualizing those metrics
- **Alertmanager** routes alerts to the team via email and Slack

### Why We Did It

A deployed application without monitoring is a black box. You do not know how much CPU the auth-service is consuming, whether the database connection pool is approaching its limit, how many 500 errors are being returned per minute, or whether the HPA has scaled a service up due to a traffic spike. Without this information, production incidents are discovered by users, not by the team.

Observability transforms operations from reactive to proactive. With Prometheus alerts configured, the team is notified of problems before they become outages.

### What Prometheus Collects

Prometheus scrapes the standard Kubernetes metrics endpoints exposed by the kubelet on each node. These include:

- Pod CPU and memory usage (consumed by HPA for autoscaling decisions)
- Node CPU, memory, disk, and network I/O
- Container restart counts (a rising restart count indicates a CrashLoopBackOff pattern)
- Request latency and error rate histograms from the Gateway and services (if instrumented)
- PVC storage utilization

### What Alerts Are Configured

Defined in `infra/infrastructure/monitoring-rules.yaml`:

- **PodCrashLooping:** Fires if a pod restarts more than twice in 15 minutes. Indicates a broken container that Kubernetes cannot self-heal.
- **HighCPUUsage:** Fires if a pod's CPU utilization exceeds 80% for more than 5 minutes. Indicates the HPA may need to scale or a resource leak exists.
- **PVCStorageNearFull:** Fires if a PVC is more than 85% full. Indicates the NFS volume for PostgreSQL or Redis needs expansion before data loss occurs.
- **PodNotReady:** Fires if a pod fails its readiness probe for more than 3 minutes. Indicates a deployment problem or a service dependency failure.

**Why these alerts:** These four categories cover the most common failure modes in a containerized application. Crash loops indicate code problems. High CPU precedes OOM kills and cascading failures. Full storage causes database corruption. Not-ready pods mean users are getting errors.

### Grafana Dashboards

Grafana connects to Prometheus as a data source. Dashboards visualize:

- Cluster-level resource utilization across both worker nodes
- Per-namespace (dev, prod) pod counts and resource consumption
- HPA scaling events and current replica counts
- Network I/O between services
- PostgreSQL connection pool metrics (if pg_exporter is configured)

### Alertmanager Configuration

When Prometheus fires an alert, it forwards the alert payload to Alertmanager. Alertmanager deduplicates repeated alerts, groups related alerts together, and routes them to the configured receivers. FlowForge configures email as the primary receiver. The email is sent using the same Gmail SMTP setup used by the application's email service.

### How Dashboards Are Exposed

The monitoring dashboards are accessible via the central `dashboard-gateway` in the `gateway` namespace. HTTPRoute resources in the `monitoring` namespace attach to the `dashboard-gateway` (permitted by the `ReferenceGrant` in the gateway namespace) and map hostnames to cluster services:

- `grafana.flowforge.fun` → `grafana` Service in `monitoring` namespace
- `prometheus.flowforge.fun` → `prometheus-operated` Service in `monitoring` namespace (HAProxy basic auth applied)

---

## SLIDE 17 — Learnings and What This Project Demonstrates

### Technical Learnings

**Infrastructure is code:**
Every component of this system — from the HAProxy configuration to the Kubernetes network policies to the GitHub Actions workflows — is a text file in a Git repository. Any engineer can understand the entire system by reading the code. There is no undocumented configuration.

**Security must be built in, not added later:**
The multi-stage Dockerfile, the Kyverno admission policy, the Sealed Secrets, the network policies, and the SAST/SCA/Trivy pipeline steps were designed from the beginning. Retrofitting security into an existing system is far harder and less effective.

**Manual gates are features, not limitations:**
The decision to require human promotion before traffic shifts 100% was deliberate. Automated systems can detect that a pod is healthy; they cannot detect that a business logic change is correct. Human judgment is an essential part of a reliable deployment process.

**Observability is not optional:**
Without Prometheus and Grafana, the team would have no visibility into the system's health. The monitoring stack is not a nice-to-have addition. It is as essential as the application itself.

**GitOps eliminates configuration drift:**
Before GitOps, production environments tend to diverge from the documented state over time due to manual hotfixes and undocumented changes. With Argo CD enforcing Git as the source of truth, drift is impossible. The cluster always matches what is in the repository.

### What This Project Demonstrates

This project is a complete, working demonstration of a production-grade DevSecOps pipeline. It shows:

1. A microservices application built with security practices embedded from the first line of the Dockerfile.
2. A CI pipeline that enforces code quality, dependency safety, and image security on every commit automatically.
3. A GitOps-driven CD system where the cluster state is always defined in Git and applied automatically.
4. Controlled deployment strategies (Blue-Green and Canary) that allow safe, reversible releases with zero downtime.
5. A governance model where production deployments require explicit human decisions at every stage.
6. A monitoring and alerting system that provides full visibility into the health of every component.
7. A secret management system that allows secrets to be stored safely in a public Git repository.
8. A network security model where inter-service communication is restricted to the minimum necessary by policy.

This is not a proof-of-concept. It is the real system, running in production, serving real traffic at `flowforge.fun`.
