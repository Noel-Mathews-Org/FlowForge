output "jumpbox_private_ip" {
  description = "The private IP address of the jumpbox VM"
  value       = azurerm_network_interface.jumpbox_nic.private_ip_address
}

output "jumpbox_vm_id" {
  description = "The resource ID of the jumpbox VM"
  value       = azurerm_linux_virtual_machine.jumpbox.id
}

output "jumpbox_name" {
  description = "The name of the jumpbox VM"
  value       = azurerm_linux_virtual_machine.jumpbox.name
}
