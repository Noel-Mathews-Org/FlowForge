output "redis_primary_connection_string" {
  value     = azurerm_redis_cache.redis.primary_connection_string
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
