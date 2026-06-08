variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}
variable "fw_subnet_id" {
  type = string
}
variable "aks_subnet_id" {
  type = string
}
variable "appgw_subnet_id" {
  type = string
}
variable "gateway_subnet_id" {
  type = string
}
variable "spoke_vnet_cidr" {
  type = string
  default = "192.169.0.0/16" 
}
variable "aws_vpc_cidr" {
  type = string
  default = "10.0.0.0/16" 
}
