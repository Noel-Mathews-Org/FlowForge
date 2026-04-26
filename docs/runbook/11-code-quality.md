# 11 - Code Quality

**Parent:** [Runbook Index](./00-index.md)

---

## 11.1 Why SonarQube

SonarQube is a self-hosted static analysis platform that inspects source code on every commit. It measures code quality across multiple dimensions and applies a quality gate that determines whether the code meets the defined standard.

The key reasons for using SonarQube in FlowForge:

1. **SAST integrated into the pipeline:** Security vulnerabilities are caught at the code level before any container is built or deployed.
2. **Consistent standards across services:** All six services are held to identical quality gate criteria, regardless of who wrote the code.
3. **Historical tracking:** SonarQube tracks metrics over time, making it possible to see whether code quality is improving or degrading with each sprint.
4. **Team feedback loop:** Developers see exactly which lines of code introduced a vulnerability or bug pattern, with a description of the risk and suggested remediation.

---

## 11.2 SonarQube Project Configuration

Each service has its own SonarQube project with a dedicated project key and authentication token. This isolates quality metrics per service and allows per-service quality gate policies.

| Service | SonarQube Project Key | Trigger |
|:---|:---|:---|
| auth-service | `Flow_auth_service` | Push to `test` branch, `auth-service/**` |
| project-service | `Flow_project_service` | Push to `test` branch, `project-service/**` |
| task-service | `Flow_task_service` | Push to `test` branch, `task-service/**` |
| analysis-service | `Flow_analysis_service` | Push to `test` branch, `analysis-service/**` |
| gateway | `Flow_gateway` | Push to `test` branch, `gateway/**` |
| frontend | `Flow_frontend` | Push to `test` branch, `frontend/**` |

The `sonar-project.properties` file in each service directory defines the project key for the scanner. The scanner reads this file automatically when invoked from the service directory.

---

## 11.3 Quality Gate: Recommended Parameters

The following quality gate should be created in the SonarQube server under **Quality Gates** and named **FlowForge Gate**. Assign this gate to all six FlowForge projects.

**Quality Gate Name:** `FlowForge Gate`

| Metric | Condition | Threshold | Applies To |
|:---|:---|:---|:---|
| Security Rating | is worse than | A | New Code |
| Reliability Rating | is worse than | A | New Code |
| Maintainability Rating | is worse than | A | New Code |
| Coverage | is less than | 0% | New Code |
| Duplicated Lines (%) | is greater than | 3% | New Code |
| Security Hotspots Reviewed | is less than | 100% | New Code |
| Bugs | is greater than | 0 | New Code |
| Vulnerabilities | is greater than | 0 | New Code |
| Code Smells | is greater than | 5 | New Code |

**Rating Scale Reference:**

| Rating | Security Vulnerabilities | Reliability Bugs |
|:---|:---|:---|
| A | 0 | 0 |
| B | At least 1 Minor | At least 1 Minor |
| C | At least 1 Major | At least 1 Major |
| D | At least 1 Critical | At least 1 Critical |
| E | At least 1 Blocker | At least 1 Blocker |

**Note on Coverage:** The threshold is set to 0% because the Python microservices do not currently include unit test suites in the repository. Setting coverage to 0% prevents the quality gate from failing due to the absence of tests while still tracking all security and reliability metrics. As the project matures, this threshold should be raised.

---

## 11.4 What SonarQube Reports On

For the Python services, SonarQube analyzes:
- SQL injection patterns in database query construction
- Hardcoded credentials and secrets
- Use of insecure functions (e.g., `exec`, `eval`, `pickle`)
- Insecure random number generation for security purposes
- Proper exception handling
- Code duplication across modules

For the Next.js frontend, SonarQube analyzes:
- Cross-site scripting (XSS) patterns in JSX
- Dangerous use of `dangerouslySetInnerHTML`
- Insecure HTTP requests (mixed content)
- TypeScript type safety issues
- Unused variables and dead code

---

## 11.5 How to Access the SonarQube Dashboard

SonarQube is accessible at `sonar.flowforge.fun`. HAProxy routes this subdomain directly to the SonarQube EC2 instance at `10.0.1.248:9000`.

No password protection is applied at the HAProxy layer. Authentication is handled by SonarQube's own login system.

After a CI run, the pipeline posts the analysis results to SonarQube. The quality gate result appears in the project dashboard within 1-3 minutes of the pipeline completing the SonarQube scan stage.
