resource "azurerm_public_ip" "appgw_pip" {
  name                = "pip-appgw"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_application_gateway" "appgw" {
  name                = "appgw-flowforge-prod"
  location            = var.location
  resource_group_name = var.resource_group_name

  sku {
    name     = "WAF_v2"
    tier     = "WAF_v2"
    capacity = 2
  }

  gateway_ip_configuration {
    name      = "appgw-ip-config"
    subnet_id = var.appgw_subnet_id
  }

  firewall_policy_id = azurerm_web_application_firewall_policy.waf.id

  frontend_port {
    name = "frontend-port"
    port = 80
  }

  frontend_ip_configuration {
    name                 = "frontend-ip-config-public"
    public_ip_address_id = azurerm_public_ip.appgw_pip.id
  }

  frontend_ip_configuration {
    name                          = "frontend-ip-config-private"
    subnet_id                     = var.appgw_subnet_id
    private_ip_address_allocation = "Static"
    private_ip_address            = "192.168.1.10"
  }

  backend_address_pool {
    name         = "aks-backend-pool"
    ip_addresses = [var.backend_ip_address]
  }

  backend_http_settings {
    name                  = "http-settings"
    cookie_based_affinity = "Disabled"
    path                  = "/"
    port                  = 80
    protocol              = "Http"
    request_timeout       = 60
  }

  http_listener {
    name                           = "listener"
    frontend_ip_configuration_name = "frontend-ip-config-public"
    frontend_port_name             = "frontend-port"
    protocol                       = "Http"
  }

  request_routing_rule {
    name                       = "routing-rule"
    rule_type                  = "Basic"
    http_listener_name         = "listener"
    backend_address_pool_name  = "aks-backend-pool"
    backend_http_settings_name = "http-settings"
    priority                   = 100
  }

}

resource "azurerm_web_application_firewall_policy" "waf" {
  name                = "waf-appgw-flowforge-prod"
  location            = var.location
  resource_group_name = var.resource_group_name

  policy_settings {
    enabled                     = true
    mode                        = "Prevention"
    request_body_check          = true
    file_upload_limit_in_mb     = 100
    max_request_body_size_in_kb = 128
  }

  managed_rules {
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"
    }
  }
}
