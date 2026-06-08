variable "resource_group_name" {
  type = string
}
variable "location" {
  type = string
}
variable "appgw_subnet_id" {
  type = string
}
variable "backend_ip_address" { 
  type = string 
  description = "The Private IP of the AKS Internal Load Balancer"
  default = "192.169.1.50" 
}
