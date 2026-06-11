resource "azurerm_subnet" "gw" {
  name                 = "GatewaySubnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = var.hub_vnet_name
  address_prefixes     = [var.gateway_subnet_cidr]
}

resource "azurerm_public_ip" "vpngw_pip" {
  name                = "pip-vpngw-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static" # VpnGw1AZ requires Static PIP
  sku                 = "Standard"
  tags                = { Env = var.env, Owner = var.owner }
}

resource "azurerm_virtual_network_gateway" "vpngw" {
  name                = "vpngw-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name

  type     = "Vpn"
  vpn_type = "RouteBased"

  active_active = false
  bgp_enabled   = false
  sku           = "VpnGw1AZ"

  ip_configuration {
    name                          = "vpngw-ipconf"
    public_ip_address_id          = azurerm_public_ip.vpngw_pip.id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.gw.id
  }

  vpn_client_configuration {
    address_space        = [var.vpn_client_address_pool]
    vpn_client_protocols = ["OpenVPN"]
    vpn_auth_types       = ["AAD"]
    aad_tenant           = "https://login.microsoftonline.com/${var.entra_tenant_id}/"
    aad_audience         = var.entra_audience
    aad_issuer           = "https://sts.windows.net/${var.entra_tenant_id}/"
  }

  tags = { Env = var.env, Owner = var.owner }
}

resource "azurerm_monitor_diagnostic_setting" "vpngw_diag" {
  name                       = "diag-vpngw"
  target_resource_id         = azurerm_virtual_network_gateway.vpngw.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "GatewayDiagnosticLog"
  }
  enabled_log {
    category = "TunnelDiagnosticLog"
  }
  enabled_metric {
    category = "AllMetrics"
  }
}
