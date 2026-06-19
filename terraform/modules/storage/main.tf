resource "azurerm_storage_account" "sa" {
  name                            = var.storage_account_name
  resource_group_name             = var.resource_group_name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  public_network_access_enabled   = false
  allow_nested_items_to_be_public = false

  tags = { Env = var.env, Layer = "data ${var.env}" }
}

resource "azurerm_storage_container" "app_data" {
  name                  = "app-data"
  storage_account_id    = azurerm_storage_account.sa.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "ai_reports" {
  name                  = "ai-incident-reports"
  storage_account_id    = azurerm_storage_account.sa.id
  container_access_type = "private"
}

# Role Assignment for AKS to access Storage
resource "azurerm_role_assignment" "aks_storage_blob_data_contributor" {
  scope                = azurerm_storage_account.sa.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.aks_managed_identity_principal_id
}

# Storage Private Endpoint
resource "azurerm_private_endpoint" "pe_storage" {
  name                = "pe-storage-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.pe_subnet_id

  private_service_connection {
    name                           = "psc-storage"
    private_connection_resource_id = azurerm_storage_account.sa.id
    is_manual_connection           = false
    subresource_names              = ["blob"]
  }

  private_dns_zone_group {
    name                 = "pdzg-storage"
    private_dns_zone_ids = [var.private_dns_zone_storage_id]
  }

  tags = { Env = var.env, Layer = "data ${var.env}" }
}

# Diagnostic settings for Storage Account -> Log Analytics
resource "azurerm_monitor_diagnostic_setting" "storage_diag" {
  name                       = "diag-storage-${var.env}"
  target_resource_id         = "${azurerm_storage_account.sa.id}/blobServices/default"
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "StorageRead"
  }

  enabled_log {
    category = "StorageWrite"
  }

  enabled_log {
    category = "StorageDelete"
  }

  enabled_metric {
    category = "Transaction"
  }
}

