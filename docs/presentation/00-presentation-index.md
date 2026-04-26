# FlowForge — Presentation Master Index

**Project:** FlowForge  
**Presented by:** Noel Mathews  

---

## Presentation Slide Order

This folder contains the full written content for every slide in the FlowForge presentation.
Each file covers a group of slides. Attach the architecture diagram images at the marked positions.

---

### File 1 — [slides-01-intro-and-problem.md](./slides-01-intro-and-problem.md)

| Slide | Title |
|:---|:---|
| Slide 1 | Title Slide — FlowForge, Noel Mathews |
| Slide 2 | Problem Statement and Objective |
| Slide 3 | Before DevOps: The Manual Era |
| Slide 4 | After DevOps: Automation, Governance, and Confidence |

---

### File 2 — [slides-02-architecture-and-reference.md](./slides-02-architecture-and-reference.md)

| Slide | Title |
|:---|:---|
| Slide 5 | Application Architecture *(attach diagram)* |
| Slide 6 | Database Architecture *(attach diagram)* |
| Slide 7 | DevOps Architecture *(attach diagram)* |
| Slide 8 | Microservices and Container Port Reference |
| Slide 9 | Domains, Subdomains, and Routing |

---

### File 3 — [slides-03-journey-docker-and-k8s.md](./slides-03-journey-docker-and-k8s.md)

| Slide | Title |
|:---|:---|
| Slide 10 | Journey: Dockerizing the Application |
| Slide 11 | Journey: Docker Compose for Local Testing |
| Slide 12 | Journey: Writing Kubernetes Manifests |

Covers: Dockerfile security, multi-stage builds, non-root user, Argo Rollouts vs Deployments, Blue-Green vs Canary vs Rolling Update, Pod Anti-Affinity, Liveness and Readiness Probes, StatefulSets, HPA, Sealed Secrets, NFS CSI Storage, Network Policies.

---

### File 4 — [slides-04-journey-cicd-and-argocd.md](./slides-04-journey-cicd-and-argocd.md)

| Slide | Title |
|:---|:---|
| Slide 13 | Journey: Building the CI Pipeline |
| Slide 14 | Journey: Setting Up Argo CD and GitOps CD |

Covers: SAST, SCA, Trivy, SHA governance strategy, GitOps write-back, deployment governance, manual promotion gates, production release gates, wrong image prevention, Helm namespace isolation.

---

### File 5 — [slides-05-journey-dast-observability-learnings.md](./slides-05-journey-dast-observability-learnings.md)

| Slide | Title |
|:---|:---|
| Slide 15 | Journey: Dynamic Application Security Testing (DAST) |
| Slide 16 | Journey: Observability — Prometheus, Grafana, Alertmanager |
| Slide 17 | Learnings and What This Project Demonstrates |

Covers: DAST methodology, Prometheus alerts, Grafana dashboards, Alertmanager routing, dashboard exposure via kgateway, key technical learnings.

---

## Image Placeholders

The following images need to be inserted into the presentation at the marked slides.
Place them in this folder alongside the content files.

| Slide | Image Needed |
|:---|:---|
| Slide 5 | Application Architecture Diagram |
| Slide 6 | Database Architecture / Schema Diagram |
| Slide 7 | DevOps Architecture Diagram (CI/CD pipeline end-to-end) |
| Slide 13 | CI Pipeline Stages Screenshot (GitHub Actions) |
| Slide 14 | Argo CD Application Sync Screenshot |
| Slide 15 | DAST Report Screenshot |
| Slide 16 | Grafana Dashboard Screenshot |
| Slide 16 | Argo Rollouts Dashboard Screenshot (50% Canary split) |
