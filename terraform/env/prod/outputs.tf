output "frontend_url" {
  value = "https://${var.domain}"
}

output "app_identity_client_id" {
  description = "The Workload Identity Client ID to put in values-prod.yaml"
  value       = azurerm_user_assigned_identity.app_identity.client_id
}

output "azure_tenant_id" {
  description = "The Azure Tenant ID to put in values-common.yaml"
  value       = data.azurerm_client_config.current.tenant_id
}

output "keyvault_name" {
  value = module.key_vault.kv_name
}

output "keyvault_uri" {
  value = module.key_vault.kv_vault_uri
}

output "storage_account_name" {
  value = module.storage.storage_account_name
}

output "postgres_connection_string" {
  description = "Ready-to-use DATABASE_URL for Postgres"
  value       = "database-url=postgresql+asyncpg://${module.databases.postgres_admin_username}:${urlencode(var.postgres_admin_password)}@${module.databases.postgres_fqdn}:5432/postgres?ssl=require"
  sensitive   = true
}

output "redis_endpoint" {
  description = "Ready-to-use REDIS_URL"
  value       = "redis-url=rediss://:${module.databases.redis_primary_access_key}@${module.databases.redis_hostname}:${module.databases.redis_port}"
  sensitive   = true
}
