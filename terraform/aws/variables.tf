variable "region" {
  description = "AWS Region"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "private_subnet_cidr" {
  description = "CIDR block for Private Subnet"
  type        = string
}

variable "azure_vpngw_ip" {
  description = "Public IP of the Azure VPN Gateway (Dummy IP for initialization)"
  type        = string
}

variable "azure_vnet_cidr" {
  description = "CIDR block of the Azure Network (to route back)"
  type        = string
}

variable "shared_key" {
  description = "Shared key for VPN connection"
  type        = string
}


