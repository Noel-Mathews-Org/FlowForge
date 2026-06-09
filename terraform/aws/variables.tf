variable "region" {
  description = "AWS Region"
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidr" {
  description = "CIDR block for Private Subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "azure_vpngw_ip" {
  description = "Public IP of the Azure VPN Gateway"
  type        = string
  # NO DEFAULT - forces user to supply it
}

variable "azure_vnet_cidr" {
  description = "CIDR block of the Azure Network (to route back)"
  type        = string
  default     = "192.168.0.0/15" # Covers Hub (192.168.0.0/16) and Spoke (192.169.0.0/16)
}

variable "shared_key" {
  description = "Shared key for VPN connection"
  type        = string
}
