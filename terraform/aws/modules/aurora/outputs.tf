output "aurora_cluster_endpoint" { value = aws_rds_cluster.postgresql.endpoint }
output "aurora_reader_endpoint" { value = aws_rds_cluster.postgresql.reader_endpoint }
