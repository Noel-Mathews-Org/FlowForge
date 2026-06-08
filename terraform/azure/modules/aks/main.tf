resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-flowforge-prod"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = "flowforge"

  # Enforce Private Cluster and User-Defined Routing (No Public IP)
  private_cluster_enabled = true

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
    outbound_type     = "userDefinedRouting" # Critical for no PIP
    load_balancer_sku = "standard"
  }
}
