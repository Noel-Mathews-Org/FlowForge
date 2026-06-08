resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

data "azurerm_client_config" "current" {}

# ==========================================
# 1. AZURE CACHE FOR REDIS
# ==========================================
resource "azurerm_redis_enterprise_cluster" "redis" {
  name                = "redis-flowforge-${random_string.suffix.result}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku_name            = "Balanced_B1"
}

resource "azurerm_redis_enterprise_database" "redis_db" {
  name              = "default"
  cluster_id        = azurerm_redis_enterprise_cluster.redis.id
  client_protocol   = "Encrypted"
  clustering_policy = "EnterpriseCluster"
  eviction_policy   = "NoEviction"
  port              = 10000
}

# ==========================================
# 2. AZURE KEY VAULT
# ==========================================
resource "azurerm_key_vault" "kv" {
  name                      = "kv-ff-${random_string.suffix.result}"
  location                  = var.location
  resource_group_name       = var.resource_group_name
  tenant_id                 = data.azurerm_client_config.current.tenant_id
  sku_name                  = "standard"
  rbac_authorization_enabled = true
  
  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
  }
}

# ==========================================
# 3. AZURE STORAGE ACCOUNT
# ==========================================
resource "azurerm_storage_account" "sa" {
  name                     = "saff${random_string.suffix.result}"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  
  public_network_access_enabled = false
}

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate-files"
  storage_account_name  = azurerm_storage_account.sa.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "reports" {
  name                  = "application-reports"
  storage_account_name  = azurerm_storage_account.sa.name
  container_access_type = "private"
}

# ==========================================
# 4. PRIVATE DNS ZONES
# ==========================================
resource "azurerm_private_dns_zone" "redis_dns" {
  name                = "privatelink.redis.cache.windows.net"
  resource_group_name = var.resource_group_name
}
resource "azurerm_private_dns_zone" "kv_dns" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = var.resource_group_name
}
resource "azurerm_private_dns_zone" "blob_dns" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = var.resource_group_name
}

# Link DNS Zones to Spoke VNet
resource "azurerm_private_dns_zone_virtual_network_link" "redis_link" {
  name                  = "redis-link"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.redis_dns.name
  virtual_network_id    = var.spoke_vnet_id
}
resource "azurerm_private_dns_zone_virtual_network_link" "kv_link" {
  name                  = "kv-link"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.kv_dns.name
  virtual_network_id    = var.spoke_vnet_id
}
resource "azurerm_private_dns_zone_virtual_network_link" "blob_link" {
  name                  = "blob-link"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.blob_dns.name
  virtual_network_id    = var.spoke_vnet_id
}

# ==========================================
# 5. PRIVATE ENDPOINTS
# ==========================================
resource "azurerm_private_endpoint" "redis_pe" {
  name                = "pe-redis"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.pe_subnet_id

  private_service_connection {
    name                           = "redis-privatelink"
    private_connection_resource_id = azurerm_redis_enterprise_cluster.redis.id
    is_manual_connection           = false
    subresource_names              = ["redisEnterprise"]
  }
  private_dns_zone_group {
    name                 = "redis-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.redis_dns.id]
  }
}

resource "azurerm_private_endpoint" "kv_pe" {
  name                = "pe-kv"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.pe_subnet_id

  private_service_connection {
    name                           = "kv-privatelink"
    private_connection_resource_id = azurerm_key_vault.kv.id
    is_manual_connection           = false
    subresource_names              = ["vault"]
  }
  private_dns_zone_group {
    name                 = "kv-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.kv_dns.id]
  }
}

resource "azurerm_private_endpoint" "blob_pe" {
  name                = "pe-blob"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.pe_subnet_id

  private_service_connection {
    name                           = "blob-privatelink"
    private_connection_resource_id = azurerm_storage_account.sa.id
    is_manual_connection           = false
    subresource_names              = ["blob"]
  }
  private_dns_zone_group {
    name                 = "blob-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.blob_dns.id]
  }
}

# ==========================================
# 6. ROLE ASSIGNMENTS (RBAC)
# ==========================================
# Give current executing user admin access to Key Vault
resource "azurerm_role_assignment" "kv_admin_user" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Administrator"
  principal_id         = var.current_user_object_id
}

# Give AKS Managed Identity access to read secrets
resource "azurerm_role_assignment" "kv_reader_aks" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.aks_kubelet_identity_object_id
}

# Give AKS Managed Identity access to read/write blobs
resource "azurerm_role_assignment" "blob_contributor_aks" {
  scope                = azurerm_storage_account.sa.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.aks_kubelet_identity_object_id
}
