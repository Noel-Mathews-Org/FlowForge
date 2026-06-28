# FlowForge Cloud Infrastructure & Azure Architecture

This document outlines the Azure-native Hub-and-Spoke infrastructure topology deployed via Terraform to support the FlowForge microservices application.

---

## 1. Network Topology (Hub-and-Spoke)

The environment utilizes a secure Hub-and-Spoke network layout to isolate compute resources from the public internet.

```text
  [ Public Ingress ]                     [ Private Management ]
          │                                        │
          ▼                                        ▼
┌───────────────────┐                    ┌───────────────────┐
│     Spoke VNet    │                    │      Hub VNet     │
│                   │                    │                   │
│  ┌─────────────┐  │                    │  ┌─────────────┐  │
│  │ App Gateway │  │                    │  │ VPN Gateway │  │
│  │ (Ingress)   │  │                    │  │ (P2S VPN)   │  │
│  └─────────────┘  │                    │  └─────────────┘  │
│         │         │                    │         │         │
│         ▼         │   VNet Peering     │         ▼         │
│  ┌─────────────┐  │◄──────────────────▶│  ┌─────────────┐  │
│  │ AKS Subnet  │  │                    │  │  Jumpbox    │  │
│  │ (Compute)   │  │                    │  │  Management │  │
│  └─────────────┘  │                    │  └─────────────┘  │
│         │         │                    │         │         │
│         ▼ (UDR)   │                    │         ▼         │
│  ┌─────────────┐  │   VNet Peering     │  ┌─────────────┐  │
│  │ PE & DB     │  │◄──────────────────▶│  │  Azure      │  │
│  │ Subnets     │  │                    │  │  Firewall   │  │
│  │ (PaaS)      │  │                    │  │  (Egress)   │  │
│  └─────────────┘  │                    │  └─────────────┘  │
└───────────────────┘                    └───────────────────┘
```

### A. Hub Virtual Network (Management Plane)
* **Gateway Subnet**: Deploys an Azure Virtual Network Gateway supporting Point-to-Site (P2S) VPN with Microsoft Entra ID authentication. This allows authorized operators to establish a secure VPN tunnel directly into the private network.
* **Management Subnet**: Hosts the Windows Server Jumpbox VM for database and configuration tasks.
* **Firewall Subnet**: Hosts the central Azure Firewall instance.

### B. Spoke Virtual Network (Application Plane)
* **Application Gateway Subnet**: Dedicated subnet for the Azure Application Gateway. The Application Gateway acts as the public ingress point, terminating SSL/TLS and routing traffic directly to the AKS load balancer.
* **AKS Subnet**: Isolated subnet for the Azure Kubernetes Service (AKS) system and user node pools.
* **Private Endpoints Subnet (`pe_subnet`)**: Houses private network interfaces for Azure PaaS services, removing them from the public internet.
* **Database Subnet (`db_subnet`)**: Isolated subnet for PostgreSQL Flexible Server delegated network traffic.

### C. VNet Peerings & DNS Resolution
* Bidirectional peerings connect the Hub VNet and Spoke VNet, enabling traffic to flow between subnets.
* Private DNS Zones are linked to both VNets to resolve private endpoint hostnames internally (e.g. `*.database.azure.com`, `*.vaultcore.azure.net`).

---

## 2. Azure PaaS & In-Network Integration

To protect sensitive storage and database data, all Azure PaaS services use **Private Link** to expose private IPs inside the `pe_subnet`:

* **Azure Database for PostgreSQL Flexible Server**: Deployed with VNet integration inside the database subnet, ensuring it can only be accessed privately by AKS pods and the Jumpbox.
* **Azure Cache for Redis**: Connected via Private Endpoint inside the private endpoints subnet for high-speed rate-limiting and job queue caching.
* **Azure Key Vault**: Exposes a Private Endpoint in `pe_subnet`. All microservice secrets, connection strings, and certificates are queried privately.
* **Azure Storage Account**: Hosts blob containers (e.g. `flowforge-reports`) for storing project attachments and document files. Reached privately via Private Endpoint.
* **Azure AI Foundry (OpenAI)**: Provisions AI cognitive services and the `summary-agent` model, accessed over secure internal connections.

---

## 3. Network Egress Control (Azure Firewall)

Outbound traffic from the AKS subnet is restricted. A **Route Table (UDR)** is attached to the AKS subnet, forcing all outbound internet traffic (`0.0.0.0/0`) through the internal private IP of the **Azure Firewall**.

The Azure Firewall enforces strict application and network filtering rules:
* **Allow Port 5432 / 6379**: Connects to the PostgreSQL and Redis endpoints inside the Spoke VNet.
* **Allow `login.microsoftonline.com`**: Outbound HTTPS for Microsoft Entra ID SSO authentication and token validation.
* **Allow `*.services.ai.azure.com`**: Outbound HTTPS calls for the AI Foundry model engine.
* **Allow `smtp.gmail.com:465` / `:587`**: Allowed SMTP port traffic for the background Notification Worker to dispatch emails.
* **Allow `ghcr.io` / `github.com`**: Essential package and container image registry downloads.

---

## 4. Workload Identity & Credentials-less Architecture

FlowForge is architected to run completely free of hardcoded connection secrets or passwords:
* **Entra ID Workload Identity**: AKS pods run under specific Kubernetes Service Accounts annotated with Azure Workload Identity client parameters.
* **OIDC Federation**: Entra ID maps the AKS cluster's OIDC issuer URL and the Service Account subject name to a User-Assigned Managed Identity.
* **Passwordless SDK**: The Python backend uses the `DefaultAzureCredential` SDK. When fetching secrets from Key Vault or writing blobs to Azure Storage, the SDK obtains a dynamic Microsoft Entra ID token automatically in the background. No passwords, client secrets, or static tokens are mounted or stored in config files.
