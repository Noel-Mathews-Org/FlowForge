output "redis_primary_connection_string" {
  value     = "rediss://:${azurerm_redis_cache.redis.primary_access_key}@${azurerm_redis_cache.redis.hostname}:6380"
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
