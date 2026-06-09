output "redis_primary_connection_string" {
  value     = "rediss://:${azurerm_managed_redis.redis.default_database[0].primary_access_key}@${azurerm_managed_redis.redis.hostname}:${azurerm_managed_redis.redis.default_database[0].port}"
  sensitive = true
}

output "key_vault_uri" {
  value = azurerm_key_vault.kv.vault_uri
}

output "storage_account_name" {
  value = azurerm_storage_account.sa.name
}

output "tfstate_container_name" {
  value = azurerm_storage_container.tfstate.name
}

output "reports_container_name" {
  value = azurerm_storage_container.reports.name
}
