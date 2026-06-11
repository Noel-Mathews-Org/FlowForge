output "appgw_id" {
  value = azurerm_application_gateway.appgw.id
}
output "appgw_pip_address" {
  value = azurerm_public_ip.appgw_pip.ip_address
}
