output "storage_account_id" {
  value = azurerm_storage_account.sa.id
}
output "storage_account_name" {
  value = azurerm_storage_account.sa.name
}
output "storage_container_name" {
  value = azurerm_storage_container.app_data.name
}
output "ai_reports_container_name" {
  value = azurerm_storage_container.ai_reports.name
}
