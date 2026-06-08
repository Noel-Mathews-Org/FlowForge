variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "vnet_cidr" {
  type = list(string)
  default = ["192.168.0.0/16"] 
}

variable "appgw_subnet_cidr" {
  type = list(string)
  default = ["192.168.1.0/24"] 
}
variable "fw_subnet_cidr" {
  type = list(string)
  default = ["192.168.2.0/24"] 
}
variable "gateway_subnet_cidr" {
  type = list(string)
  default = ["192.168.3.0/24"] 
}
variable "bastion_subnet_cidr" {
  type = list(string)
  default = ["192.168.4.0/24"] 
}
