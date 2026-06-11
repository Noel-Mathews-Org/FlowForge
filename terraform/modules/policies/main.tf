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

# Note: In a real scenario, you would have multiple azurerm_subscription_policy_assignment
# blocks mapping to Azure built-in policy definitions or custom definitions.
