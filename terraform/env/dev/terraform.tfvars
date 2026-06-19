environment            = "dev"
domain                 = "dev.flowforge.fun"
location               = "centralus"
hub_vnet_cidr          = "10.0.0.0/16"
bastion_subnet_cidr    = "10.0.1.0/27"
management_subnet_cidr = "10.0.2.0/24"
spoke_vnet_cidr        = "10.1.0.0/16"
appgw_subnet_cidr      = "10.1.1.0/24"
aks_subnet_cidr        = "10.1.2.0/23"
pe_subnet_cidr         = "10.1.4.0/24"
db_subnet_cidr         = "10.1.5.0/24"
aks_allowed_fqdns = [
  "*.azure.com", "*.docker.io", "docker.io", "production.cloudflare.docker.com", "production.cloudfront.docker.com", "mcr.microsoft.com", "*.ubuntu.com", "*.ghcr.io", "ghcr.io", "*.azurecr.io", "*.pkg.dev", "*.helm.sh", "*.githubusercontent.com",
  "github.com", "api.github.com", "*.quay.io", "quay.io", "*.letsencrypt.org", "letsencrypt.org", "*.k8s.io", "registry.k8s.io",
  "*.azmk8s.io", "login.microsoftonline.com", "packages.microsoft.com", "*.data.mcr.microsoft.com", "*.cdn.mscr.io", "acs-mirror.azureedge.net",
  "*.ecr.aws", "public.ecr.aws", "*.cloudfront.net"
]
aks_vm_size             = "Standard_D2ads_v7"
postgres_sku            = "B_Standard_B1ms"
postgres_version        = "16"
postgres_storage_mb     = 131072
postgres_storage_tier   = "P10"
redis_enterprise_sku    = "Balanced_B1"
postgres_admin_username = "pgadmin"
postgres_admin_password = "P@ssw0rd1234!"
key_vault_name          = "kv-dev-ff-a1b2"
storage_account_name    = "stffdeva1b2"
postgres_server_name    = "psql-dev-ff-a1b2"
redis_cache_name        = "redis-dev-ff-a1b2"
aks_cluster_name        = "aks-dev-a1b2"

# Security & Access Control
devops_group_object_id  = ""
devtest_group_object_id = ""
jumpbox_admin_password  = "P@ssw0rdJumpb0x!"
jumpbox_vm_size         = "Standard_D2s_v3"
