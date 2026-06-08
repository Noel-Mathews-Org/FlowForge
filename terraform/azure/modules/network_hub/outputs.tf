output "hub_vnet_name" { value = azurerm_virtual_network.hub.name }
output "hub_vnet_id" { value = azurerm_virtual_network.hub.id }
output "appgw_subnet_id" { value = azurerm_subnet.appgw.id }
output "fw_subnet_id" { value = azurerm_subnet.fw.id }
output "gateway_subnet_id" { value = azurerm_subnet.gateway.id }
output "bastion_subnet_id" { value = azurerm_subnet.bastion.id }
