variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}
variable "vnet_cidr" {
  type = list(string)
  default = ["192.169.0.0/16"] 
}
variable "aks_subnet_cidr" {
  type = list(string)
  default = ["192.169.1.0/24"] 
}
variable "pe_subnet_cidr" {
  type = list(string)
  default = ["192.169.2.0/24"] 
}
variable "hub_vnet_name" {
  type = string
}
variable "hub_vnet_id" {
  type = string
}
