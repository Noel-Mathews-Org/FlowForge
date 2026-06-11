output "vpngw_id" {
  value = azurerm_virtual_network_gateway.vpngw.id
}
output "vpngw_public_ip" {
  value = azurerm_public_ip.vpngw_pip.ip_address
}
