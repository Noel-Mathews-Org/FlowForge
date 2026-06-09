variable "location" {
  description = "Azure Region"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the main resource group"
  type        = string
}

variable "environment" {
  description = "Environment (dev, prod, staging)"
  type        = string
}

variable "domain_name" {
  description = "The custom domain name for Front Door"
  type        = string
}

variable "aws_cgw_ip" {
  description = "The Public IP of the AWS VPN Gateway (Dummy IP for initialization)"
  type        = string
}

variable "shared_key" {
  description = "The IPSec Shared Key"
  type        = string
}

variable "hub_vnet_cidr" {
  type = list(string)
}

variable "appgw_subnet_cidr" {
  type = list(string)
}

variable "fw_subnet_cidr" {
  type = list(string)
}

variable "gateway_subnet_cidr" {
  type = list(string)
}

variable "management_subnet_cidr" {
  type = list(string)
}

variable "bastion_subnet_cidr" {
  type = list(string)
}

variable "spoke_vnet_cidr" {
  type = list(string)
}

variable "aks_subnet_cidr" {
  type = list(string)
}

variable "pe_subnet_cidr" {
  type = list(string)
}

variable "aws_vpc_cidr" {
  type = string
}
