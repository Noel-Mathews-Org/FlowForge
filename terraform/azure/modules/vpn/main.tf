resource "azurerm_public_ip" "vpn_pip" {
  name                = "pip-vpngw"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Dynamic" # Basic/VpnGw1 uses Dynamic, generation 2 uses Static.
}

resource "azurerm_virtual_network_gateway" "vng" {
  name                = "vpngw-hub"
  location            = var.location
  resource_group_name = var.resource_group_name
  type                = "Vpn"
  vpn_type            = "RouteBased"
  active_active       = false
  enable_bgp          = true
  sku                 = "VpnGw1"

  ip_configuration {
    name                          = "vnetGatewayConfig"
    public_ip_address_id          = azurerm_public_ip.vpn_pip.id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = var.gateway_subnet_id
  }
}

resource "azurerm_local_network_gateway" "lng" {
  name                = "lng-aws"
  location            = var.location
  resource_group_name = var.resource_group_name
  gateway_address     = var.aws_cgw_ip
  address_space       = [var.aws_vpc_cidr]

  bgp_settings {
    asn                 = 65000
    bgp_peering_address = "10.0.1.254" # Placeholder for AWS BGP IP
  }
}

resource "azurerm_virtual_network_gateway_connection" "vpn_conn" {
  name                = "conn-azure-to-aws"
  location            = var.location
  resource_group_name = var.resource_group_name
  type                = "IPsec"
  virtual_network_gateway_id = azurerm_virtual_network_gateway.vng.id
  local_network_gateway_id   = azurerm_local_network_gateway.lng.id
  shared_key          = var.shared_key
}
