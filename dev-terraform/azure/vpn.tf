resource "azurerm_public_ip" "vpn_pip" {
  name                = "pip-vpngw-dev"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = ["1", "2", "3"]
}

resource "azurerm_virtual_network_gateway" "vng" {
  name                = "vpngw-dev"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  type                = "Vpn"
  vpn_type            = "RouteBased"
  active_active       = false
  sku                 = "VpnGw1AZ"

  ip_configuration {
    name                          = "vnetGatewayConfig"
    public_ip_address_id          = azurerm_public_ip.vpn_pip.id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.gateway.id
  }

  depends_on = [
    azurerm_subnet.aks,
    azurerm_subnet.pe,
    azurerm_subnet.appgw,
    azurerm_subnet.gateway
  ]
}

resource "azurerm_local_network_gateway" "lng" {
  name                = "lng-aws-dev"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  gateway_address     = var.aws_cgw_ip
  address_space       = ["10.0.0.0/16"]
}

resource "azurerm_virtual_network_gateway_connection" "vpn_conn" {
  name                       = "conn-azure-to-aws-dev"
  location                   = azurerm_resource_group.rg.location
  resource_group_name        = azurerm_resource_group.rg.name
  type                       = "IPsec"
  virtual_network_gateway_id = azurerm_virtual_network_gateway.vng.id
  local_network_gateway_id   = azurerm_local_network_gateway.lng.id
  shared_key                 = var.shared_key
}
