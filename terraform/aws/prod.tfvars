region              = "ap-south-1"
vpc_cidr            = "10.0.0.0/16"
private_subnet_cidr = "10.0.1.0/24"
azure_vnet_cidr     = "192.168.0.0/15" # Covers Hub and Spoke
azure_vpngw_ip      = "1.1.1.1"        # Dummy IP
shared_key          = "ProdSuperSecretKey99!"
