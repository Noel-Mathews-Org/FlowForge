output "aks_cluster_name" {
  value = azurerm_kubernetes_cluster.aks.name
}

output "aks_cluster_rg" {
  value = azurerm_resource_group.rg.name
}

output "appgw_public_ip" {
  value = azurerm_public_ip.appgw_pip.ip_address
}

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

output "vpn_public_ip" {
  value = azurerm_public_ip.vpn_pip.ip_address
}
