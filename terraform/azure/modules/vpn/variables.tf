variable "resource_group_name" {
  type = string
}
variable "location" {
  type = string
}
variable "gateway_subnet_id" {
  type = string
}
variable "aws_cgw_ip" { 
  type = string 
  description = "The Public IP of the AWS Customer Gateway"
  default = "1.2.3.4" # Placeholder, overridden by tfvars or data source in real deployment
}
variable "aws_vpc_cidr" {
  type = string
  default = "10.0.0.0/16"
}
variable "shared_key" {
  type = string
  default = "FlowForgeSuperSecretKey123!"
}
