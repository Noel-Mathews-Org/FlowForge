resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "aks-${var.env}"

  private_cluster_enabled = false
  local_account_disabled  = false

  default_node_pool {
    name                 = "default"
    vm_size              = var.aks_vm_size
    vnet_subnet_id       = var.aks_subnet_id
    auto_scaling_enabled = true
    min_count            = 1
    max_count            = 3
    type                 = "VirtualMachineScaleSets"
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    network_policy    = "calico"
    outbound_type     = var.aks_outbound_type
    load_balancer_sku = "standard"
  }

  oms_agent {
    log_analytics_workspace_id = var.log_analytics_workspace_id
  }

  ingress_application_gateway {
    gateway_id = var.appgw_id
  }

  tags = { Env = var.env, Owner = var.owner }
}

data "azurerm_client_config" "current" {}

# Role Assignments for AGIC Identity
# Contributor on AppGW
resource "azurerm_role_assignment" "agic_appgw" {
  scope                = var.appgw_id
  role_definition_name = "Contributor"
  principal_id         = azurerm_kubernetes_cluster.aks.ingress_application_gateway[0].ingress_application_gateway_identity[0].object_id
}

# Reader on App RG
resource "azurerm_role_assignment" "agic_rg" {
  scope                = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${var.resource_group_name}"
  role_definition_name = "Reader"
  principal_id         = azurerm_kubernetes_cluster.aks.ingress_application_gateway[0].ingress_application_gateway_identity[0].object_id
}

# Network Contributor on Spoke VNet
resource "azurerm_role_assignment" "agic_vnet" {
  scope                = var.spoke_vnet_id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_kubernetes_cluster.aks.ingress_application_gateway[0].ingress_application_gateway_identity[0].object_id
}

