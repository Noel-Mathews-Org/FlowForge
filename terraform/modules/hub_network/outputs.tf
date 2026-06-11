output "hub_vnet_id" {
  value = azurerm_virtual_network.hub.id
}
output "hub_vnet_name" {
  value = azurerm_virtual_network.hub.name
}
output "bastion_subnet_id" {
  value = azurerm_subnet.bastion.id
}
output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.law.id
}
output "private_dns_zone_kv_id" {
  value = azurerm_private_dns_zone.kv.id
}
output "private_dns_zone_storage_id" {
  value = azurerm_private_dns_zone.storage.id
}
output "private_dns_zone_postgres_id" {
  value = azurerm_private_dns_zone.postgres.id
}
output "private_dns_zone_redis_id" {
  value = azurerm_private_dns_zone.redis.id
}
