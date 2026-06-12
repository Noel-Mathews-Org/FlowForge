output "aks_id" {
  value = module.aks.aks_id
}
output "appgw_id" {
  value = module.app_gateway.appgw_id
}
output "postgres_id" {
  value = module.databases.postgres_id
}
output "redis_id" {
  value = module.databases.redis_id
}
output "kv_id" {
  value = module.key_vault.kv_id
}
output "storage_account_id" {
  value = module.storage.storage_account_id
}

# --- Connection Details and Secrets ---

output "azure_tenant_id" {
  value = data.azurerm_client_config.current.tenant_id
}

output "aks_kubelet_identity_client_id" {
  description = "The Managed Identity Client ID used by pods to authenticate to Azure Key Vault"
  value       = module.aks.aks_kubelet_identity_client_id
}

output "postgres_connection_string" {
  description = "Ready-to-use DATABASE_URL for Postgres"
  value       = "postgresql+asyncpg://${module.databases.postgres_admin_username}:${module.databases.postgres_admin_password}@${module.databases.postgres_fqdn}:5432/postgres?ssl=require"
  sensitive   = true
}

output "redis_endpoint" {
  description = "Ready-to-use REDIS_URL"
  value       = "rediss://:${module.databases.redis_primary_access_key}@${module.databases.redis_hostname}:${module.databases.redis_port}"
  sensitive   = true
}

output "storage_account_name" {
  value = module.storage.storage_account_name
}

output "storage_container_name" {
  value = module.storage.storage_container_name
}
