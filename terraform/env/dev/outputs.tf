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
