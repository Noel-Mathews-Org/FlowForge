output "frontdoor_url" { value = azurerm_cdn_frontdoor_endpoint.endpoint.host_name }
output "frontdoor_validation_token" { value = azurerm_cdn_frontdoor_custom_domain.domain.validation_token }
output "frontdoor_cname" { value = azurerm_cdn_frontdoor_endpoint.endpoint.host_name }
