variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "env" { type = string }
variable "hub_vnet_name" { type = string }
variable "fw_subnet_cidr" { type = string }
variable "log_analytics_workspace_id" { type = string }
variable "aks_subnet_id" { type = string }
variable "pe_subnet_id" { type = string }
variable "db_subnet_id" { type = string }
variable "aks_allowed_fqdns" { type = list(string) }

variable "hub_vnet_cidr" { type = string }
variable "spoke_vnet_cidr" { type = string }
variable "vpn_client_address_pool" { type = string }
variable "hub_vnet_id" { type = string }
