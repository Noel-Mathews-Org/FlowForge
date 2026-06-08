terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "sttfstateflowforge"
    container_name       = "tfstate"
    key                  = "azure.terraform.tfstate"
  }
}
