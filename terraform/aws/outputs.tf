output "aws_vpn_public_ip" {
  value       = module.vpn.aws_cgw_ip
  description = "Public IP of the AWS VPN Tunnel (Give this to Azure Local Network Gateway)"
}

output "db_endpoint" {
  value       = module.rds.db_endpoint
  description = "The Primary connection endpoint for the PostgreSQL database"
}
