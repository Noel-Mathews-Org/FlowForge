# FlowForge DevOps Runbook

**Project:** FlowForge  
**Repository:** https://github.com/Noel-Mathews-Org/FlowForge  
**Classification:** Internal Technical Documentation  

---

## Purpose

This runbook serves as the authoritative technical reference for the FlowForge platform. It documents every infrastructure decision, security implementation, pipeline design, and operational procedure in a structured, reproducible format. Engineers onboarding to the project or responding to incidents should start here.

---

## Table of Contents

| Document | Description |
|:---|:---|
| [01 - Infrastructure Overview](./01-infrastructure.md) | AWS architecture, EC2 nodes, Kubernetes cluster topology |
| [02 - Project Setup](./02-project-setup.md) | How the project is bootstrapped from scratch |
| [03 - CI/CD Pipeline Design](./03-cicd-pipeline.md) | Detailed pipeline stages, triggers, and what each step does |
| [04 - Branching and Promotion Strategy](./04-branching-strategy.md) | Branch model, dev-to-prod promotion, release governance |
| [05 - Deployment Strategies](./05-deployment-strategies.md) | Blue-Green for frontend, Canary for microservices |
| [06 - Secret Management](./06-secret-management.md) | Bitnami Sealed Secrets, why not plain Secrets, rotation |
| [07 - Security Hardening](./07-security.md) | Docker security, Kyverno, ServiceAccounts, SAST/SCA/DAST/Trivy |
| [08 - Network Architecture and Routing](./08-networking.md) | HAProxy, kgateway, HTTPRoutes, network policies, namespace isolation |
| [09 - Storage and Persistence](./09-storage.md) | NFS server, NFS CSI driver, PVCs, StatefulSets |
| [10 - Observability](./10-observability.md) | Prometheus, Grafana, Alertmanager, liveness and readiness probes |
| [11 - Code Quality](./11-code-quality.md) | SonarQube setup, quality gate parameters, why it is used |
| [12 - Connection Verification](./12-connection-verification.md) | How to verify all services are connected and healthy |
| [13 - Service and Domain Reference](./13-service-reference.md) | All microservices, ports, domains, and subdomains |

---

## Infrastructure at a Glance

| Component | Technology | Purpose |
|:---|:---|:---|
| Cloud Provider | AWS (EC2) | All nodes run on EC2 instances in a single VPC |
| Container Orchestration | Kubernetes (self-managed) | Workload scheduling and management |
| GitOps Controller | Argo CD | Declarative continuous delivery |
| Deployment Engine | Argo Rollouts | Blue-Green and Canary deployment strategies |
| CI Pipeline | GitHub Actions | Automated build, scan, test, and push |
| Image Registry | GitHub Container Registry (GHCR) | Private container image storage |
| Secret Management | Bitnami Sealed Secrets | Encrypted secrets stored safely in Git |
| Admission Controller | Kyverno | Cluster-wide policy enforcement |
| Code Quality | SonarQube (self-hosted) | SAST, code smell, and quality gate enforcement |
| Dependency Scanning | Snyk | Software Composition Analysis (SCA) |
| Image Scanning | Trivy | Container image vulnerability scanning |
| Ingress / Edge Proxy | HAProxy (EC2) | SSL termination, subdomain routing |
| Internal Routing | kgateway (Envoy-based) | Kubernetes Gateway API implementation |
| Storage | NFS (EC2) + NFS CSI Driver | Dynamic persistent volume provisioning |
| Monitoring | Prometheus + Grafana | Metrics collection and visualization |
| Alerting | Alertmanager | Alert routing to email and Slack |
