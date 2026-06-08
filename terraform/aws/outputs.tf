output "aws_vpn_public_ip" {
  value       = module.vpn.aws_cgw_ip
  description = "Public IP of the AWS VPN Tunnel (Give this to Azure Local Network Gateway)"
}

output "aurora_cluster_endpoint" {
  value       = module.aurora.aurora_cluster_endpoint
  description = "The Primary connection endpoint for the Aurora PostgreSQL database"
}

output "aurora_reader_endpoint" {
  value       = module.aurora.aurora_reader_endpoint
  description = "The Read-Only endpoint for the Aurora PostgreSQL database"
}
