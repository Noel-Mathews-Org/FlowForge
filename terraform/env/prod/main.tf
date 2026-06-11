resource "azurerm_resource_group" "hub" {
  name     = "rg-${var.environment}-hub"
  location = var.location
  tags     = { Env = var.environment, Owner = var.owner }
}

resource "azurerm_resource_group" "app" {
  name     = "rg-${var.environment}-app"
  location = var.location
  tags     = { Env = var.environment, Owner = var.owner }
}

resource "azurerm_resource_group" "data" {
  name     = "rg-${var.environment}-data"
  location = var.location
  tags     = { Env = var.environment, Owner = var.owner }
}

data "azurerm_client_config" "current" {}

module "hub_network" {
  source                 = "../../modules/hub_network"
  resource_group_name    = azurerm_resource_group.hub.name
  location               = azurerm_resource_group.hub.location
  env                    = var.environment
  owner                  = var.owner
  hub_vnet_cidr          = var.hub_vnet_cidr
  bastion_subnet_cidr    = var.bastion_subnet_cidr
  management_subnet_cidr = var.management_subnet_cidr
}

module "spoke_network" {
  source                       = "../../modules/spoke_network"
  resource_group_name          = azurerm_resource_group.app.name
  location                     = azurerm_resource_group.app.location
  env                          = var.environment
  owner                        = var.owner
  spoke_vnet_cidr              = var.spoke_vnet_cidr
  appgw_subnet_cidr            = var.appgw_subnet_cidr
  aks_subnet_cidr              = var.aks_subnet_cidr
  pe_subnet_cidr               = var.pe_subnet_cidr
  db_subnet_cidr               = var.db_subnet_cidr
  hub_vnet_id                  = module.hub_network.hub_vnet_id
  hub_vnet_name                = module.hub_network.hub_vnet_name
  hub_resource_group_name      = azurerm_resource_group.hub.name
  private_dns_zone_kv_id       = module.hub_network.private_dns_zone_kv_id
  private_dns_zone_storage_id  = module.hub_network.private_dns_zone_storage_id
  private_dns_zone_postgres_id = module.hub_network.private_dns_zone_postgres_id
  private_dns_zone_redis_id    = module.hub_network.private_dns_zone_redis_id
}

module "firewall" {
  source                     = "../../modules/firewall"
  resource_group_name        = azurerm_resource_group.hub.name
  location                   = azurerm_resource_group.hub.location
  env                        = var.environment
  owner                      = var.owner
  hub_vnet_name              = module.hub_network.hub_vnet_name
  fw_subnet_cidr             = var.fw_subnet_cidr
  log_analytics_workspace_id = module.hub_network.log_analytics_workspace_id
  aks_subnet_id              = module.spoke_network.aks_subnet_id
  pe_subnet_id               = module.spoke_network.pe_subnet_id
  db_subnet_id               = module.spoke_network.db_subnet_id
  aks_allowed_fqdns          = var.aks_allowed_fqdns
}

module "vpn_gateway" {
  source                     = "../../modules/vpn_gateway"
  resource_group_name        = azurerm_resource_group.hub.name
  location                   = azurerm_resource_group.hub.location
  env                        = var.environment
  owner                      = var.owner
  hub_vnet_name              = module.hub_network.hub_vnet_name
  gateway_subnet_cidr        = var.gateway_subnet_cidr
  log_analytics_workspace_id = module.hub_network.log_analytics_workspace_id
  vpn_client_address_pool    = var.vpn_client_address_pool
  entra_tenant_id            = data.azurerm_client_config.current.tenant_id
  entra_audience             = var.entra_audience
}

module "app_gateway" {
  source                     = "../../modules/app_gateway"
  resource_group_name        = azurerm_resource_group.app.name
  location                   = azurerm_resource_group.app.location
  env                        = var.environment
  owner                      = var.owner
  appgw_subnet_id            = module.spoke_network.appgw_subnet_id
  log_analytics_workspace_id = module.hub_network.log_analytics_workspace_id
}

module "aks" {
  source                     = "../../modules/aks"
  resource_group_name        = azurerm_resource_group.app.name
  location                   = azurerm_resource_group.app.location
  env                        = var.environment
  owner                      = var.owner
  aks_subnet_id              = module.spoke_network.aks_subnet_id
  appgw_id                   = module.app_gateway.appgw_id
  spoke_vnet_id              = module.spoke_network.spoke_vnet_id
  log_analytics_workspace_id = module.hub_network.log_analytics_workspace_id
  aks_vm_size                = var.aks_vm_size
  spoke_resource_group_name  = azurerm_resource_group.app.name
  aks_outbound_type          = "userDefinedRouting"
}

module "databases" {
  source                       = "../../modules/databases"
  resource_group_name          = azurerm_resource_group.data.name
  location                     = azurerm_resource_group.data.location
  env                          = var.environment
  owner                        = var.owner
  pe_subnet_id                 = module.spoke_network.pe_subnet_id
  private_dns_zone_postgres_id = module.hub_network.private_dns_zone_postgres_id
  private_dns_zone_redis_id    = module.hub_network.private_dns_zone_redis_id
  postgres_sku                 = var.postgres_sku
  postgres_version             = var.postgres_version
  postgres_storage_mb          = var.postgres_storage_mb
  postgres_storage_tier        = var.postgres_storage_tier
  redis_enterprise_sku         = var.redis_enterprise_sku
  log_analytics_workspace_id   = module.hub_network.log_analytics_workspace_id
  postgres_admin_username      = var.postgres_admin_username
  postgres_admin_password      = var.postgres_admin_password
}

module "key_vault" {
  source                            = "../../modules/key_vault"
  resource_group_name               = azurerm_resource_group.data.name
  location                          = azurerm_resource_group.data.location
  env                               = var.environment
  owner                             = var.owner
  pe_subnet_id                      = module.spoke_network.pe_subnet_id
  private_dns_zone_kv_id            = module.hub_network.private_dns_zone_kv_id
  log_analytics_workspace_id        = module.hub_network.log_analytics_workspace_id
  tenant_id                         = data.azurerm_client_config.current.tenant_id
  aks_managed_identity_principal_id = module.aks.aks_managed_identity_principal_id
}

module "storage" {
  source                            = "../../modules/storage"
  resource_group_name               = azurerm_resource_group.data.name
  location                          = azurerm_resource_group.data.location
  env                               = var.environment
  owner                             = var.owner
  pe_subnet_id                      = module.spoke_network.pe_subnet_id
  private_dns_zone_storage_id       = module.hub_network.private_dns_zone_storage_id
  log_analytics_workspace_id        = module.hub_network.log_analytics_workspace_id
  aks_managed_identity_principal_id = module.aks.aks_managed_identity_principal_id
}

# VNet Peering Prod (With VPN Gateway Dependency)
resource "azurerm_virtual_network_peering" "spoke_to_hub" {
  name                         = "peer-spoke-to-hub"
  resource_group_name          = azurerm_resource_group.app.name
  virtual_network_name         = module.spoke_network.spoke_vnet_name
  remote_virtual_network_id    = module.hub_network.hub_vnet_id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  use_remote_gateways          = true
  depends_on                   = [module.vpn_gateway]
}

resource "azurerm_virtual_network_peering" "hub_to_spoke" {
  name                         = "peer-hub-to-spoke"
  resource_group_name          = azurerm_resource_group.hub.name
  virtual_network_name         = module.hub_network.hub_vnet_name
  remote_virtual_network_id    = module.spoke_network.spoke_vnet_id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = true
  allow_gateway_transit        = true
  depends_on                   = [module.vpn_gateway]
}

# Commented out to prevent deployment in lab account
# module "policies" {
#   source          = "../../modules/policies"
#   env             = var.environment
#   owner           = var.owner
#   subscription_id = var.subscription_id
# }
