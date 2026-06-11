output "postgres_id" {
  value = azurerm_postgresql_flexible_server.postgres.id
}
output "redis_id" {
  value = azurerm_managed_redis.redis.id
}
