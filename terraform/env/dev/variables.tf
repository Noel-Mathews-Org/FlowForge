variable "environment" { type = string }
variable "domain" { type = string }
variable "owner" { type = string }
variable "location" { type = string }
variable "hub_vnet_cidr" { type = string }
variable "bastion_subnet_cidr" { type = string }
variable "management_subnet_cidr" { type = string }
variable "spoke_vnet_cidr" { type = string }
variable "appgw_subnet_cidr" { type = string }
variable "aks_subnet_cidr" { type = string }
variable "pe_subnet_cidr" { type = string }
variable "db_subnet_cidr" { type = string }
variable "aks_vm_size" { type = string }
variable "postgres_sku" { type = string }
variable "postgres_version" { type = string }
variable "postgres_storage_mb" { type = number }
variable "postgres_storage_tier" { type = string }
variable "redis_enterprise_sku" { type = string }
variable "postgres_admin_username" { type = string }
variable "postgres_admin_password" { type = string }
variable "key_vault_name" { type = string }
variable "storage_account_name" { type = string }
variable "postgres_server_name" { type = string }
variable "redis_cache_name" { type = string }

variable "devops_group_object_id" { type = string }
variable "devtest_group_object_id" { type = string }
variable "jumpbox_admin_password" {
  type      = string
  sensitive = true
}
variable "jumpbox_vm_size" {
  type        = string
  description = "VM size for the jumpbox. Must be available in the target region."
  default     = "Standard_B2s"
}
variable "aks_cluster_name" { type = string }
