resource "azurerm_subnet" "fw" {
  name                 = "AzureFirewallSubnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = var.hub_vnet_name
  address_prefixes     = [var.fw_subnet_cidr]
}

resource "azurerm_public_ip" "fw_pip" {
  name                = "pip-fw-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = { Env = var.env, Owner = var.owner }
}

resource "azurerm_firewall" "fw" {
  name                = "fw-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku_name            = "AZFW_VNet"
  sku_tier            = "Basic"

  ip_configuration {
    name                 = "configuration"
    subnet_id            = azurerm_subnet.fw.id
    public_ip_address_id = azurerm_public_ip.fw_pip.id
  }

  tags = { Env = var.env, Owner = var.owner }
}

resource "azurerm_firewall_application_rule_collection" "aks_rules" {
  name                = "aks-app-rules"
  azure_firewall_name = azurerm_firewall.fw.name
  resource_group_name = var.resource_group_name
  priority            = 100
  action              = "Allow"

  rule {
    name             = "AllowAKSReqs"
    source_addresses = ["*"]
    target_fqdns     = var.aks_allowed_fqdns
    protocol {
      port = 443
      type = "Https"
    }
    protocol {
      port = 80
      type = "Http"
    }
  }
}

# Route Table for Spoke Subnets
resource "azurerm_route_table" "spoke_rt" {
  name                          = "rt-spoke-${var.env}"
  location                      = var.location
  resource_group_name           = var.resource_group_name
  bgp_route_propagation_enabled = true

  route {
    name                   = "RouteToFirewall"
    address_prefix         = "0.0.0.0/0"
    next_hop_type          = "VirtualAppliance"
    next_hop_in_ip_address = azurerm_firewall.fw.ip_configuration[0].private_ip_address
  }

  tags = { Env = var.env, Owner = var.owner }
}

# Route Table Associations
resource "azurerm_subnet_route_table_association" "aks" {
  subnet_id      = var.aks_subnet_id
  route_table_id = azurerm_route_table.spoke_rt.id
}

resource "azurerm_subnet_route_table_association" "pe" {
  subnet_id      = var.pe_subnet_id
  route_table_id = azurerm_route_table.spoke_rt.id
}

resource "azurerm_subnet_route_table_association" "db" {
  subnet_id      = var.db_subnet_id
  route_table_id = azurerm_route_table.spoke_rt.id
}

resource "azurerm_monitor_diagnostic_setting" "fw_diag" {
  name                       = "diag-fw"
  target_resource_id         = azurerm_firewall.fw.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "AzureFirewallApplicationRule"
  }
  enabled_log {
    category = "AzureFirewallNetworkRule"
  }
  enabled_metric {
    category = "AllMetrics"
  }
}
