variable "env" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "subnet_id" { type = string }
variable "admin_password" {
  type      = string
  sensitive = true
}
variable "vm_size" {
  type        = string
  description = "The Azure VM size for the jumpbox. Must be available in the target region. Defaults to Standard_B2s which is broadly available in Canada Central."
  default     = "Standard_B2s"
}
