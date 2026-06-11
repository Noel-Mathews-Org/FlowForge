output "spoke_vnet_id" {
  value = azurerm_virtual_network.spoke.id
}
output "spoke_vnet_name" {
  value = azurerm_virtual_network.spoke.name
}
output "appgw_subnet_id" {
  value = azurerm_subnet.appgw.id
}
output "aks_subnet_id" {
  value = azurerm_subnet.aks.id
}
output "pe_subnet_id" {
  value = azurerm_subnet.pe.id
}
output "db_subnet_id" {
  value = azurerm_subnet.db.id
}
