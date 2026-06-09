resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

data "azurerm_client_config" "current" {}

module "network_hub" {
  source              = "./modules/network_hub"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  vnet_cidr           = var.hub_vnet_cidr
  appgw_subnet_cidr   = var.appgw_subnet_cidr
  fw_subnet_cidr      = var.fw_subnet_cidr
  gateway_subnet_cidr    = var.gateway_subnet_cidr
  management_subnet_cidr = var.management_subnet_cidr
  bastion_subnet_cidr    = var.bastion_subnet_cidr
}

module "network_spoke" {
  source              = "./modules/network_spoke"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  hub_vnet_name       = module.network_hub.hub_vnet_name
  hub_vnet_id         = module.network_hub.hub_vnet_id
  vnet_cidr           = var.spoke_vnet_cidr
  aks_subnet_cidr     = var.aks_subnet_cidr
  pe_subnet_cidr      = var.pe_subnet_cidr
}

module "firewall" {
  source              = "./modules/firewall"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  fw_subnet_id        = module.network_hub.fw_subnet_id
  aks_subnet_id       = module.network_spoke.aks_subnet_id
  appgw_subnet_id     = module.network_hub.appgw_subnet_id
  gateway_subnet_id   = module.network_hub.gateway_subnet_id
  spoke_vnet_cidr     = var.spoke_vnet_cidr[0]
  aws_vpc_cidr        = var.aws_vpc_cidr
}

module "aks" {
  source              = "./modules/aks"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  aks_subnet_id       = module.network_spoke.aks_subnet_id
  appgw_id            = module.app_gateway.appgw_id

  depends_on = [
    module.firewall
  ]
}

module "app_gateway" {
  source              = "./modules/app_gateway"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  appgw_subnet_id     = module.network_hub.appgw_subnet_id
}

# module "front_door" {
#   source                  = "./modules/front_door"
#   resource_group_name     = azurerm_resource_group.rg.name
#   domain_name             = var.domain_name
#   appgw_public_ip_address = module.app_gateway.appgw_public_ip
# }

module "vpn" {
  source              = "./modules/vpn"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  gateway_subnet_id   = module.network_hub.gateway_subnet_id
  aws_cgw_ip          = var.aws_cgw_ip
  shared_key          = var.shared_key
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

# VNet Peering Spoke to Hub (Moved to root to manage VPN Gateway dependency)
resource "azurerm_virtual_network_peering" "spoke_to_hub" {
  name                      = "peer-spoke-to-hub"
  resource_group_name       = azurerm_resource_group.rg.name
  virtual_network_name      = module.network_spoke.spoke_vnet_name
  remote_virtual_network_id = module.network_hub.hub_vnet_id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  use_remote_gateways          = true 

  # Wait for the VPN Gateway to be fully created before allowing Spoke to use it
  depends_on = [
    module.vpn
  ]
}
