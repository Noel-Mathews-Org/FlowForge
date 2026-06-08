module "vpc" {
  source              = "./modules/vpc"
  vpc_cidr            = var.vpc_cidr
  private_subnet_cidr = var.private_subnet_cidr
  azure_vnet_cidr     = var.azure_vnet_cidr
  region              = var.region
}

module "aurora" {
  source               = "./modules/aurora"
  vpc_id               = module.vpc.vpc_id
  private_subnet_id    = module.vpc.private_subnet_id
  db_security_group_id = module.vpc.db_security_group_id
  region               = var.region
}

module "vpn" {
  source          = "./modules/vpn"
  vpc_id          = module.vpc.vpc_id
  route_table_id  = module.vpc.route_table_id
  azure_vpngw_ip  = var.azure_vpngw_ip
  azure_vnet_cidr = var.azure_vnet_cidr
}
