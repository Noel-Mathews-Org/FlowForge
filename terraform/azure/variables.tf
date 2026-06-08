variable "location" {
  description = "Azure Region"
  type        = string
  default     = "centralindia"
}

variable "resource_group_name" {
  description = "Name of the main resource group"
  type        = string
  default     = "rg-flowforge-prod"
}

variable "environment" {
  description = "Environment (dev, prod, staging)"
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "The custom domain name for Front Door"
  type        = string
  default     = "flowforge.com"
}
