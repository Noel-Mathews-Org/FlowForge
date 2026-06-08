resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

data "azurerm_client_config" "current" {}

module "network_hub" {
  source              = "./modules/network_hub"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  vnet_cidr           = ["192.168.0.0/16"]
  appgw_subnet_cidr   = ["192.168.1.0/24"]
  fw_subnet_cidr      = ["192.168.2.0/24"]
  gateway_subnet_cidr = ["192.168.3.0/24"]
  bastion_subnet_cidr = ["192.168.4.0/24"]
}

module "network_spoke" {
  source              = "./modules/network_spoke"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  hub_vnet_name       = module.network_hub.hub_vnet_name
  hub_vnet_id         = module.network_hub.hub_vnet_id
  vnet_cidr           = ["192.169.0.0/16"]
  aks_subnet_cidr     = ["192.169.1.0/24"]
  pe_subnet_cidr      = ["192.169.2.0/24"]
}

module "firewall" {
  source              = "./modules/firewall"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  fw_subnet_id        = module.network_hub.fw_subnet_id
  aks_subnet_id       = module.network_spoke.aks_subnet_id
  appgw_subnet_id     = module.network_hub.appgw_subnet_id
  gateway_subnet_id   = module.network_hub.gateway_subnet_id
  spoke_vnet_cidr     = "192.169.0.0/16"
  aws_vpc_cidr        = "10.0.0.0/16"
}

module "aks" {
  source              = "./modules/aks"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  aks_subnet_id       = module.network_spoke.aks_subnet_id
}

module "app_gateway" {
  source              = "./modules/app_gateway"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  appgw_subnet_id     = module.network_hub.appgw_subnet_id
}

module "front_door" {
  source                  = "./modules/front_door"
  resource_group_name     = azurerm_resource_group.rg.name
  domain_name             = var.domain_name
  appgw_public_ip_address = module.app_gateway.appgw_public_ip
}

module "vpn" {
  source              = "./modules/vpn"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  gateway_subnet_id   = module.network_hub.gateway_subnet_id
}

module "paas" {
  source                         = "./modules/paas"
  resource_group_name            = azurerm_resource_group.rg.name
  location                       = azurerm_resource_group.rg.location
  pe_subnet_id                   = module.network_spoke.pe_subnet_id
  spoke_vnet_id                  = module.network_spoke.spoke_vnet_id
  current_user_object_id         = data.azurerm_client_config.current.object_id
  aks_kubelet_identity_object_id = module.aks.kubelet_identity_object_id
}
