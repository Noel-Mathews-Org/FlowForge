resource "azurerm_public_ip" "vpn_pip" {
  name                = "pip-vpngw-1"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = ["1", "2", "3"]
}

# resource "azurerm_public_ip" "vpn_pip_2" {
#   name                = "pip-vpngw-2"
#   location            = var.location
#   resource_group_name = var.resource_group_name
#   allocation_method   = "Static"
#   sku                 = "Standard"
#   zones               = ["1", "2", "3"]
# }

resource "azurerm_virtual_network_gateway" "vng" {
  name                = "vpngw-hub"
  location            = var.location
  resource_group_name = var.resource_group_name
  type                = "Vpn"
  vpn_type            = "RouteBased"
  active_active       = false
  bgp_enabled         = false
  sku                 = "VpnGw1AZ"

  ip_configuration {
    name                          = "vnetGatewayConfig1"
    public_ip_address_id          = azurerm_public_ip.vpn_pip.id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = var.gateway_subnet_id
  }

  # ip_configuration {
  #   name                          = "vnetGatewayConfig2"
  #   public_ip_address_id          = azurerm_public_ip.vpn_pip_2.id
  #   private_ip_address_allocation = "Dynamic"
  #   subnet_id                     = var.gateway_subnet_id
  # }
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

  ipsec_policy {
    dh_group         = "DHGroup14"
    ike_encryption   = "AES256"
    ike_integrity    = "SHA256"
    ipsec_encryption = "AES256"
    ipsec_integrity  = "SHA256"
    pfs_group        = "PFS14"
    sa_datasize      = 102400000
    sa_lifetime      = 3600
  }
}
