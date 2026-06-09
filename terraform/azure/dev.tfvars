environment          = "dev"
resource_group_name  = "rg-flowforge-dev"
location             = "centralindia"
domain_name          = "dev.flowforge.com"
shared_key           = "DevSecretKey123_"
aws_cgw_ip           = "13.200.69.42"

hub_vnet_cidr        = ["192.168.0.0/16"]
appgw_subnet_cidr    = ["192.168.1.0/24"]
fw_subnet_cidr       = ["192.168.2.0/24"]
gateway_subnet_cidr  = ["192.168.3.0/24"]
management_subnet_cidr = ["192.168.5.0/24"]
bastion_subnet_cidr  = ["192.168.4.0/24"]

spoke_vnet_cidr      = ["192.169.0.0/16"]
aks_subnet_cidr      = ["192.169.1.0/24"]
pe_subnet_cidr       = ["192.169.2.0/24"]

aws_vpc_cidr         = "10.0.0.0/16"
