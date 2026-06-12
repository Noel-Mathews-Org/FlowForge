output "postgres_id" {
  value = azurerm_postgresql_flexible_server.postgres.id
}
output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.postgres.fqdn
}
output "postgres_admin_username" {
  value = azurerm_postgresql_flexible_server.postgres.administrator_login
}
output "postgres_admin_password" {
  value     = azurerm_postgresql_flexible_server.postgres.administrator_password
  sensitive = true
}

output "redis_id" {
  value = azurerm_managed_redis.redis.id
}
output "redis_hostname" {
  value = azurerm_managed_redis.redis.hostname
}
output "redis_port" {
  value = azurerm_managed_redis.redis.default_database[0].port
}
output "redis_primary_access_key" {
  value     = azurerm_managed_redis.redis.default_database[0].primary_access_key
  sensitive = true
}
