resource "azurerm_virtual_network" "spoke" {
  name                = "vnet-spoke"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = var.vnet_cidr
}

resource "azurerm_subnet" "aks" {
  name                 = "AksSubnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.spoke.name
  address_prefixes     = var.aks_subnet_cidr
}

resource "azurerm_subnet" "pe" {
  name                 = "PrivateEndpointsSubnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.spoke.name
  address_prefixes     = var.pe_subnet_cidr
}

# NSGs
resource "azurerm_network_security_group" "aks_nsg" {
  name                = "nsg-aks"
  location            = var.location
  resource_group_name = var.resource_group_name
  # Allow internal VNet traffic
  security_rule {
    name                       = "Allow_VNet_Inbound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "VirtualNetwork"
  }
}

resource "azurerm_subnet_network_security_group_association" "aks_nsg_assoc" {
  subnet_id                 = azurerm_subnet.aks.id
  network_security_group_id = azurerm_network_security_group.aks_nsg.id
}

# VNet Peering Hub to Spoke
resource "azurerm_virtual_network_peering" "hub_to_spoke" {
  name                      = "peer-hub-to-spoke"
  resource_group_name       = var.resource_group_name
  virtual_network_name      = var.hub_vnet_name
  remote_virtual_network_id = azurerm_virtual_network.spoke.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  allow_gateway_transit        = true
}


