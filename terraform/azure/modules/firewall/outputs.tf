output "firewall_private_ip" { value = azurerm_firewall.fw.ip_configuration[0].private_ip_address }
output "firewall_public_ip" { value = azurerm_public_ip.fw_pip.ip_address }
output "fw_route_table_appgw_id" { value = azurerm_route_table.appgw_rt.id }
output "fw_route_table_aks_id" { value = azurerm_route_table.aks_rt.id }
output "fw_route_table_gateway_id" { value = azurerm_route_table.gateway_rt.id }
