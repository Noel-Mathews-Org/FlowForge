# Example Policy Assignment for Tagging (Require Env and Owner)
resource "azurerm_subscription_policy_assignment" "require_tags" {
  name                 = "require-env-owner-tags"
  subscription_id      = "/subscriptions/${var.subscription_id}"
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/1e30110a-5ceb-460c-a204-c1c3969c6d62"
  description          = "Require Env and Owner tags on resources"
  display_name         = "Require Env and Owner Tags"

  parameters = jsonencode({
    "tagName" : {
      "value" : "Env"
    }
  })
}

# Example Policy Assignment for Deny PaaS without private endpoint (Storage)
resource "azurerm_subscription_policy_assignment" "deny_public_storage" {
  name                 = "deny-pub-storage"
  subscription_id      = "/subscriptions/${var.subscription_id}"
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/b2982b36-99f2-4db5-8eff-283140c09693"
  description          = "Storage accounts should restrict network access"
  display_name         = "Deny Public Access on Storage"
}

# -----------------------------------------------------------------------------------------
# Diagnostic Settings Policies (DeployIfNotExists)
# These policies automatically configure diagnostic settings for resources to send logs 
# to the central Log Analytics Workspace.
# -----------------------------------------------------------------------------------------

# PostgreSQL Flexible Server Diagnostic Settings
resource "azurerm_subscription_policy_assignment" "diag_postgres" {
  name                 = "diag-postgres"
  subscription_id      = "/subscriptions/${var.subscription_id}"
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/78ed47da-513e-41e9-a088-e829b373281d"
  description          = "Deploy Diagnostic Settings for PostgreSQL flexible servers to Log Analytics workspace"
  display_name         = "Deploy PostgreSQL Diagnostic Settings"
  location             = var.location

  identity {
    type = "SystemAssigned"
  }

  parameters = jsonencode({
    "logAnalytics" : {
      "value" : var.log_analytics_workspace_id
    }
  })
}

# Key Vault Diagnostic Settings
resource "azurerm_subscription_policy_assignment" "diag_kv" {
  name                 = "diag-kv"
  subscription_id      = "/subscriptions/${var.subscription_id}"
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/bef3f64c-5290-43b7-85b0-9b254eef4c47"
  description          = "Deploy Diagnostic Settings for Key Vault to Log Analytics workspace"
  display_name         = "Deploy Key Vault Diagnostic Settings"
  location             = var.location

  identity {
    type = "SystemAssigned"
  }

  parameters = jsonencode({
    "logAnalytics" : {
      "value" : var.log_analytics_workspace_id
    }
  })
}

# AKS Diagnostic Settings
resource "azurerm_subscription_policy_assignment" "diag_aks" {
  name                 = "diag-aks"
  subscription_id      = "/subscriptions/${var.subscription_id}"
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/6c66c325-74c8-42fd-a286-a74b0e2939d8"
  description          = "Deploy Diagnostic Settings for Azure Kubernetes Service to Log Analytics workspace"
  display_name         = "Deploy AKS Diagnostic Settings"
  location             = var.location

  identity {
    type = "SystemAssigned"
  }

  parameters = jsonencode({
    "logAnalytics" : {
      "value" : var.log_analytics_workspace_id
    }
  })
}

# Redis Diagnostic Settings
resource "azurerm_subscription_policy_assignment" "diag_redis" {
  name            = "diag-redis"
  subscription_id = "/subscriptions/${var.subscription_id}"
  # Note: This is the built-in policy for Azure Cache for Redis. 
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/42168925-5735-4424-9548-52266858E585"
  description          = "Deploy Diagnostic Settings for Azure Cache for Redis to Log Analytics workspace"
  display_name         = "Deploy Redis Diagnostic Settings"
  location             = var.location

  identity {
    type = "SystemAssigned"
  }

  parameters = jsonencode({
    "logAnalytics" : {
      "value" : var.log_analytics_workspace_id
    }
  })
}

# Note: Add additional azurerm_subscription_policy_assignment blocks here for other resources
# (Storage, Firewall, App Gateway, VPN Gateway) using their respective built-in policy IDs.

# IMPORTANT: The SystemAssigned identity created by these policy assignments requires the 
# 'Monitoring Contributor' role on the subscription to successfully create diagnostic settings.
resource "azurerm_role_assignment" "policy_postgres_monitoring_contributor" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Monitoring Contributor"
  principal_id         = azurerm_subscription_policy_assignment.diag_postgres.identity[0].principal_id
}

resource "azurerm_role_assignment" "policy_kv_monitoring_contributor" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Monitoring Contributor"
  principal_id         = azurerm_subscription_policy_assignment.diag_kv.identity[0].principal_id
}

resource "azurerm_role_assignment" "policy_aks_monitoring_contributor" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Monitoring Contributor"
  principal_id         = azurerm_subscription_policy_assignment.diag_aks.identity[0].principal_id
}

resource "azurerm_role_assignment" "policy_redis_monitoring_contributor" {
  scope                = "/subscriptions/${var.subscription_id}"
  role_definition_name = "Monitoring Contributor"
  principal_id         = azurerm_subscription_policy_assignment.diag_redis.identity[0].principal_id
}
