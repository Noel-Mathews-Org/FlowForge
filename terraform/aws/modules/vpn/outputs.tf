output "aws_cgw_ip" { value = aws_vpn_connection.main.tunnel1_address }
output "aws_bgp_asn" { value = aws_customer_gateway.cgw.bgp_asn }
