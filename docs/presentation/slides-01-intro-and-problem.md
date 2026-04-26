# Presentation Content — Part 1: Introduction and Problem Statement

---

## SLIDE 1 — Title Slide

**Project Name:** FlowForge

**Subtitle:** A Cloud-Native Project and Task Management Platform built on a Production-Ready DevSecOps Pipeline

**Presented by:** Noel Mathews

---

## SLIDE 2 — About the Project

### What is FlowForge?

FlowForge is an enterprise-grade, cloud-native project and task management platform built on a microservices architecture. It enables teams to collaborate on projects, manage tasks on a Kanban board, and gain real-time productivity insights through an analytics dashboard.

**The platform consists of 6 microservices:**

| Service | Role |
|:---|:---|
| API Gateway | Single entry point — JWT auth, rate limiting, request routing |
| Auth Service | User management, login, token handling, team invitations |
| Project Service | Project and workspace lifecycle, email notifications |
| Task Service | Kanban task management, assignments, comments |
| Analysis Service | Analytics, productivity metrics, event consumption |
| Frontend | Next.js 14 web application served to end users |

**Backing infrastructure:** PostgreSQL 16 (single instance, 4 logical databases), Redis 7 (rate limiting + event bus), deployed on a self-managed Kubernetes cluster on AWS.

### Our Objective

The goal of this project is not just to build an application — it is to deploy and operate it using a **robust, automated DevSecOps pipeline** that enforces code quality, security scanning, controlled deployments, and full observability from day one. Every infrastructure decision is version-controlled, every deployment is auditable, and every release passes through automated security gates before reaching production.

---

## SLIDE 3 — The Problem: Before DevOps

### How Software Was Deployed Before DevOps

Before DevOps, development and operations were separate teams. Code was handed off through tickets. Deployment was a manual, high-risk, scheduled event.

**The typical release process:**

1. Developer finishes a feature locally.
2. Code is zipped and copied to a shared drive or server.
3. Ops team schedules a deployment window — usually Friday night.
4. An engineer SSH-es into production and manually copies files.
5. Services are restarted one by one. Someone watches logs in a terminal.
6. If something breaks — no automated rollback. The engineer must remember the previous state, restore files manually, and restart again under pressure.

**What was missing:**

- No repeatability — "It works on my machine" was a valid explanation.
- No infrastructure version control — no one knew what was actually on the server.
- No automated testing or security scanning — vulnerabilities shipped with the code.
- No monitoring — outages were reported by users, not detected by the team.
- No safe rollback — recovery was manual, slow, and error-prone.

---

## SLIDE 4 — The Solution: DevSecOps

### Why DevOps Changed Everything

DevOps eliminated the wall between development and operations by automating the entire path from code to production. It made delivery fast, repeatable, auditable, and safe.

**What DevOps delivers:**

- **Continuous Integration:** Every code push is automatically built, tested, and scanned. Feedback in minutes, not days.
- **Continuous Delivery:** The path from a passing build to a deployed application is automated. The only human decision is when to release.
- **Infrastructure as Code:** The entire infrastructure is defined in Git — versioned, reviewable, and reproducible.
- **Automated Rollback:** Failed health checks trigger automatic rollback. No human intervention needed.
- **Monitoring and Alerting:** Every service is continuously measured. The team is notified before users notice a problem.

**Why security must be built in (DevSecOps):**

Security that is added at the end of a release cycle is always too late. By the time a vulnerability is found in production, it may already be exploited. FlowForge integrates security at every stage:

- Source code scanned for vulnerabilities (SAST via SonarQube)
- Dependencies checked against CVE databases (SCA via Snyk)
- Container images scanned before pushing to registry (Trivy)
- Network policies enforce zero-trust communication between services
- Secrets encrypted and stored safely in Git (Bitnami Sealed Secrets)

**Why infrastructure matters:**

An application is only as reliable as the infrastructure beneath it. FlowForge is deployed on a self-managed Kubernetes cluster with redundant nodes, automated health checks, persistent NFS-backed storage, and a load balancer — so the application survives failures, recovers automatically, and scales to meet demand.
