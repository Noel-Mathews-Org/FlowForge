environment               = "prod"
owner                     = "prod-team"
location                  = "canadacentral"
hub_vnet_cidr             = "192.168.0.0/20"
bastion_subnet_cidr       = "192.168.1.0/27"
management_subnet_cidr    = "192.168.2.0/24"
gateway_subnet_cidr       = "192.168.3.0/27"
fw_subnet_cidr            = "192.168.4.0/26"
fw_management_subnet_cidr = "192.168.4.64/26"
spoke_vnet_cidr           = "192.168.16.0/20"
appgw_subnet_cidr         = "192.168.17.0/24"
aks_subnet_cidr           = "192.168.18.0/23"
pe_subnet_cidr            = "192.168.20.0/24"
db_subnet_cidr            = "192.168.21.0/24"
vpn_client_address_pool   = "172.16.0.0/24"
aks_vm_size               = "Standard_D2s_v3"
postgres_sku              = "B_Standard_B1ms"
postgres_version          = "16"
postgres_storage_mb       = 131072
postgres_storage_tier     = "P10"
redis_enterprise_sku      = "Balanced_B1"
aks_allowed_fqdns = [
  "*.azure.com", "*.docker.io", "docker.io", "production.cloudflare.docker.com", "production.cloudfront.docker.com", "mcr.microsoft.com", "*.ubuntu.com", "*.ghcr.io", "ghcr.io", "*.azurecr.io", "*.pkg.dev", "*.helm.sh", "*.githubusercontent.com",
  "github.com", "api.github.com", "*.quay.io", "quay.io", "*.letsencrypt.org", "letsencrypt.org", "*.k8s.io", "registry.k8s.io",
  "*.azmk8s.io", "login.microsoftonline.com", "packages.microsoft.com", "*.data.mcr.microsoft.com", "*.cdn.mscr.io", "acs-mirror.azureedge.net"
]
postgres_admin_username = "pgadmin"
postgres_admin_password = "P@ssw0rd1234!"
entra_audience          = "41b23e61-6c1e-4545-b367-cd054e0ed4b4"
