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

# output "front_door_url" {
#   value       = module.front_door.frontdoor_url
#   description = "The default Azure Front Door URL"
# }

# output "dns_cname_record" {
#   value       = "Create a CNAME record in your DNS provider: ${var.domain_name} -> ${module.front_door.frontdoor_cname}"
#   description = "Instruction for DNS CNAME mapping"
# }

# output "dns_txt_validation_record" {
#   value       = "Create a TXT record for _dnsauth.${var.domain_name} with value: ${module.front_door.frontdoor_validation_token}"
#   description = "Instruction for Azure Front Door SSL domain validation"
# }

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
