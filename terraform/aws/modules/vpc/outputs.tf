output "vpc_id" { value = aws_vpc.main.id }
output "private_subnet_id" { value = aws_subnet.private.id }
output "db_security_group_id" { value = aws_security_group.db_sg.id }
output "route_table_id" { value = aws_route_table.private.id }
