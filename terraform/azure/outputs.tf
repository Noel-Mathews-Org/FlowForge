output "appgw_public_ip" {
  value       = module.app_gateway.appgw_public_ip
  description = "Public IP of the Application Gateway (Map your DNS A Record to this IP)"
}

output "firewall_public_ip" {
  value       = module.firewall.firewall_public_ip
  description = "Public IP of the Azure Firewall (Outbound SNAT IP)"
}

output "vpn_gateway_public_ip" {
  value       = module.vpn.vpn_gateway_public_ip
  description = "Public IP of the Azure VPN Gateway (Give this to AWS CGW)"
}


output "redis_primary_connection_string" {
  value       = module.paas.redis_primary_connection_string
  description = "Primary connection string for Azure Cache for Redis"
  sensitive   = true
}

output "key_vault_uri" {
  value       = module.paas.key_vault_uri
  description = "URI of the Azure Key Vault"
}

output "storage_account_name" {
  value       = module.paas.storage_account_name
  description = "Name of the Azure Storage Account"
}
