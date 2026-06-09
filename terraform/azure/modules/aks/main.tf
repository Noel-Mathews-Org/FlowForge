resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-flowforge-prod"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "flowforge"

  # User wants public cluster but routing outbound through firewall
  private_cluster_enabled = false

  default_node_pool {
    name                = "default"
    vm_size             = "Standard_D2s_v3"
    vnet_subnet_id      = var.aks_subnet_id
    auto_scaling_enabled = true
    min_count           = 1
    max_count           = 3
    type                = "VirtualMachineScaleSets"
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    network_policy    = "calico"
    outbound_type     = "userDefinedRouting" # Critical for firewall egress
    load_balancer_sku = "standard"
  }

  ingress_application_gateway {
    gateway_id = var.appgw_id
  }
}

data "azurerm_client_config" "current" {}

# Grant AGIC Managed Identity permission to read App Gateway
resource "azurerm_role_assignment" "agic_appgw" {
  scope                = var.appgw_id
  role_definition_name = "Contributor"
  principal_id         = azurerm_kubernetes_cluster.aks.ingress_application_gateway[0].ingress_application_gateway_identity[0].object_id
}

# Grant AGIC Managed Identity permission to read the Resource Group
resource "azurerm_role_assignment" "agic_rg" {
  scope                = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${var.resource_group_name}"
  role_definition_name = "Reader"
  principal_id         = azurerm_kubernetes_cluster.aks.ingress_application_gateway[0].ingress_application_gateway_identity[0].object_id
}
