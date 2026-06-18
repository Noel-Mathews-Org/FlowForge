# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "postgres" {
  name                         = var.postgres_server_name
  resource_group_name          = var.resource_group_name
  location                     = var.location
  version                      = var.postgres_version
  sku_name                     = var.postgres_sku
  storage_mb                   = var.postgres_storage_mb
  storage_tier                 = var.postgres_storage_tier
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false


  administrator_login    = var.postgres_admin_username
  administrator_password = var.postgres_admin_password

  tags = { Env = var.env, Owner = var.owner }

  lifecycle {
    ignore_changes = [
      zone,
      high_availability.0.standby_availability_zone
    ]
  }
}

# Active directory administrator removed per user request

# PostgreSQL Private Endpoint
resource "azurerm_private_endpoint" "pe_postgres" {
  name                = "pe-postgres-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.pe_subnet_id

  private_service_connection {
    name                           = "psc-postgres"
    private_connection_resource_id = azurerm_postgresql_flexible_server.postgres.id
    is_manual_connection           = false
    subresource_names              = ["postgresqlServer"]
  }

  private_dns_zone_group {
    name                 = "pdzg-postgres"
    private_dns_zone_ids = [var.private_dns_zone_postgres_id]
  }

  tags = { Env = var.env, Owner = var.owner }
}

# Azure Managed Redis
resource "azurerm_managed_redis" "redis" {
  name                = var.redis_cache_name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku_name            = var.redis_enterprise_sku

  tags = { Env = var.env, Owner = var.owner }

  default_database {
    clustering_policy                  = "EnterpriseCluster"
    eviction_policy                    = "VolatileLRU"
    access_keys_authentication_enabled = true
  }
}

# Redis Private Endpoint
resource "azurerm_private_endpoint" "pe_redis" {
  name                = "pe-redis-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.pe_subnet_id

  private_service_connection {
    name                           = "psc-redis"
    private_connection_resource_id = azurerm_managed_redis.redis.id
    is_manual_connection           = false
    subresource_names              = ["redisEnterprise"]
  }

  private_dns_zone_group {
    name                 = "pdzg-redis"
    private_dns_zone_ids = [var.private_dns_zone_redis_id]
  }

  tags = { Env = var.env, Owner = var.owner }
}

