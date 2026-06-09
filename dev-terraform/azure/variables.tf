variable "resource_group_name" {
  type        = string
  description = "Name of the resource group"
  default     = "rg-flowforge-dev"
}

variable "location" {
  type        = string
  description = "Azure region"
  default     = "centralindia"
}

variable "aws_cgw_ip" {
  type        = string
  description = "Public IP of the AWS VPN Gateway"
}

variable "shared_key" {
  type        = string
  description = "Shared key for VPN connection"
  default     = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6!"
}

variable "vnet_cidr" {
  type        = string
  description = "CIDR for the Dev VNet"
  default     = "192.168.0.0/16"
}
