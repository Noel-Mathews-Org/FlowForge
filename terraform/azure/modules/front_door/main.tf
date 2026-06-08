#resource "azurerm_cdn_frontdoor_profile" "fd" {
#  name                = "fd-flowforge-prod"
#  resource_group_name = var.resource_group_name
#  sku_name            = "Standard_AzureFrontDoor"
#}
#
#resource "azurerm_cdn_frontdoor_endpoint" "endpoint" {
#  name                     = "fde-flowforge"
#  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.fd.id
#}
#
#resource "azurerm_cdn_frontdoor_origin_group" "origin_group" {
#  name                     = "appgw-origin-group"
#  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.fd.id
#  session_affinity_enabled = false
#
#  load_balancing {
#    additional_latency_in_milliseconds = 50
#    sample_size                        = 4
#    successful_samples_required        = 3
#  }
#
#  health_probe {
#    path                = "/"
#    request_type        = "HEAD"
#    protocol            = "Http"
#    interval_in_seconds = 100
#  }
#}
#
#resource "azurerm_cdn_frontdoor_origin" "appgw_origin" {
#  name                           = "appgw-origin"
#  cdn_frontdoor_origin_group_id  = azurerm_cdn_frontdoor_origin_group.origin_group.id
#  enabled                        = true
#  host_name                      = var.appgw_public_ip_address
#  http_port                      = 80
#  https_port                     = 443
#  origin_host_header             = var.appgw_public_ip_address
#  certificate_name_check_enabled = false
#  priority                       = 1
#  weight                         = 1000
#}
#
#resource "azurerm_cdn_frontdoor_route" "route" {
#  name                          = "default-route"
#  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.endpoint.id
#  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.origin_group.id
#  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.appgw_origin.id]
#  supported_protocols           = ["Http", "Https"]
#  patterns_to_match             = ["/*"]
#  forwarding_protocol           = "HttpOnly"
#  link_to_default_domain        = true
#}
#
#resource "azurerm_cdn_frontdoor_custom_domain" "domain" {
#  name                     = "flowforge-custom-domain"
#  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.fd.id
#  host_name                = var.domain_name
#
#  tls {
#    certificate_type    = "ManagedCertificate"
#    minimum_version     = "TLS12"
#  }
#}
