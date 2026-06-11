resource "azurerm_virtual_network" "hub" {
  name                = "vnet-${var.env}-hub"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = [var.hub_vnet_cidr]
  tags = {
    Env   = var.env
    Owner = var.owner
  }
}

resource "azurerm_subnet" "bastion" {
  name                 = "AzureBastionSubnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = [var.bastion_subnet_cidr]
}

resource "azurerm_subnet" "management" {
  name                 = "snet-management"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = [var.management_subnet_cidr]
}

resource "azurerm_log_analytics_workspace" "law" {
  name                = "law-${var.env}-hub"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags = {
    Env   = var.env
    Owner = var.owner
  }
}

resource "azurerm_application_insights" "appinsights" {
  name                = "appi-${var.env}-hub"
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "web"
  tags = {
    Env   = var.env
    Owner = var.owner
  }
}
