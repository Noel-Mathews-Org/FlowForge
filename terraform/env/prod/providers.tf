terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "4.77.0"
    }
  }
  # backend "azurerm" {
  #   # Assuming backend config is passed via terraform init or partial config
  #   resource_group_name  = "rg-terraform-state"
  #   storage_account_name = "stffstate001"
  #   container_name       = "tfstate"
  #   key                  = "prod.terraform.tfstate"
  # }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    key_vault {
      purge_soft_delete_on_destroy    = false # In prod, prevent purge
      recover_soft_deleted_key_vaults = true
    }
  }
  # subscription_id = var.subscription_id
  # tenant_id       = var.tenant_id
}
