resource "azurerm_public_ip" "fw_pip" {
  name                = "pip-firewall"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_firewall" "fw" {
  name                = "fw-hub"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku_name            = "AZFW_VNet"
  sku_tier            = "Standard"

  ip_configuration {
    name                 = "configuration"
    subnet_id            = var.fw_subnet_id
    public_ip_address_id = azurerm_public_ip.fw_pip.id
  }
}

# Network Rules
resource "azurerm_firewall_network_rule_collection" "net_rules" {
  name                = "fw-net-rules"
  azure_firewall_name = azurerm_firewall.fw.name
  resource_group_name = var.resource_group_name
  priority            = 100
  action              = "Allow"

  rule {
    name                  = "Allow-AppGw-to-AKS"
    source_addresses      = ["192.168.1.0/24"]
    destination_addresses = ["192.169.1.0/24"]
    destination_ports     = ["80", "443"]
    protocols             = ["TCP"]
  }

  rule {
    name                  = "Allow-AKS-to-AppGw"
    source_addresses      = ["192.169.1.0/24"]
    destination_addresses = ["192.168.1.0/24"]
    destination_ports     = ["1024-65535"] # Return traffic ports
    protocols             = ["TCP"]
  }



  rule {
    name                  = "Allow-SMTP"
    source_addresses      = ["192.169.1.0/24"]
    destination_addresses = ["*"]
    destination_ports     = ["587"]
    protocols             = ["TCP"]
  }

  rule {
    name                  = "Allow-AKS-to-Internet-HTTPS"
    source_addresses      = ["192.169.1.0/24"]
    destination_addresses = ["*"]
    destination_ports     = ["80", "443", "1024-65535"]
    protocols             = ["TCP", "UDP"]
  }
}

# Application Rules
resource "azurerm_firewall_application_rule_collection" "app_rules" {
  name                = "fw-app-rules"
  azure_firewall_name = azurerm_firewall.fw.name
  resource_group_name = var.resource_group_name
  priority            = 100
  action              = "Allow"

  rule {
    name             = "Allow-All-Traffic"
    source_addresses = ["*"]
    target_fqdns     = ["*"]
    protocol {
      port = "443"
      type = "Https"
    }
    protocol {
      port = "80"
      type = "Http"
    }
  }
}

# Route Tables

resource "azurerm_route_table" "appgw_rt" {
  name                = "rt-appgw"
  location            = var.location
  resource_group_name = var.resource_group_name
}

resource "azurerm_route_table" "aks_rt" {
  name                = "rt-aks"
  location            = var.location
  resource_group_name = var.resource_group_name

  route {
    name                   = "Force-Internet-Through-FW"
    address_prefix         = "0.0.0.0/0"
    next_hop_type          = "VirtualAppliance"
    next_hop_in_ip_address = azurerm_firewall.fw.ip_configuration[0].private_ip_address
  }
}



# Subnet Associations

resource "azurerm_subnet_route_table_association" "appgw_rt_assoc" {
  subnet_id      = var.appgw_subnet_id
  route_table_id = azurerm_route_table.appgw_rt.id
}

resource "azurerm_subnet_route_table_association" "aks_rt_assoc" {
  subnet_id      = var.aks_subnet_id
  route_table_id = azurerm_route_table.aks_rt.id
}


