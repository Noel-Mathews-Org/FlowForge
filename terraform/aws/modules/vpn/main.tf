resource "aws_vpn_gateway" "vgw" {
  vpc_id = var.vpc_id
  tags = {
    Name = "vgw-flowforge-prod"
  }
}

resource "aws_customer_gateway" "cgw" {
  bgp_asn    = 65515 # Azure default BGP ASN
  ip_address = var.azure_vpngw_ip
  type       = "ipsec.1"
  tags = {
    Name = "cgw-azure-hub"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpn_connection" "main" {
  vpn_gateway_id      = aws_vpn_gateway.vgw.id
  customer_gateway_id = aws_customer_gateway.cgw.id
  type                = "ipsec.1"
  static_routes_only  = true
  
  tunnel1_preshared_key = var.shared_key
  tunnel2_preshared_key = var.shared_key

}

resource "aws_vpn_gateway_route_propagation" "private" {
  vpn_gateway_id = aws_vpn_gateway.vgw.id
  route_table_id = var.route_table_id
}

resource "aws_vpn_connection_route" "azure_dev" {
  destination_cidr_block = var.azure_vnet_cidr
  vpn_connection_id      = aws_vpn_connection.main.id
}
