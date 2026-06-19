resource "azurerm_network_interface" "jumpbox_nic" {
  name                = "nic-jumpbox-${var.env}"
  location            = var.location
  resource_group_name = var.resource_group_name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = var.subnet_id
    private_ip_address_allocation = "Dynamic"
  }

  tags = {
    Env   = var.env
    Layer = "hub ${var.env}"
  }
}

resource "azurerm_linux_virtual_machine" "jumpbox" {
  name                            = "vm-jumpbox-${var.env}"
  resource_group_name             = var.resource_group_name
  location                        = var.location
  size                            = var.vm_size
  admin_username                  = "adminuser"
  admin_password                  = var.admin_password
  disable_password_authentication = false
  zone                            = "1"

  network_interface_ids = [
    azurerm_network_interface.jumpbox_nic.id,
  ]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  tags = {
    Env   = var.env
    Layer = "hub ${var.env}"
  }
}
