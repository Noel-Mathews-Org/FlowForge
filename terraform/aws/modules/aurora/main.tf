# RDS Requires at least 2 subnets in different AZs for a Subnet Group
resource "aws_subnet" "dummy_private" {
  vpc_id            = var.vpc_id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.region}b"
  tags = {
    Name = "subnet-private-dummy-db"
  }
}

resource "aws_db_subnet_group" "aurora_subnet_group" {
  name       = "aurora-subnet-group"
  subnet_ids = [var.private_subnet_id, aws_subnet.dummy_private.id]
}

resource "aws_rds_cluster" "postgresql" {
  cluster_identifier      = "aurora-flowforge-prod"
  engine                  = "aurora-postgresql"
  engine_version          = "15.3"
  database_name           = "flowforge"
  master_username         = "flowforgeadmin"
  master_password         = "SecurePassword123!" # In real scenario, use Secrets Manager
  db_subnet_group_name    = aws_db_subnet_group.aurora_subnet_group.name
  vpc_security_group_ids  = [var.db_security_group_id]
  skip_final_snapshot     = true
}

resource "aws_rds_cluster_instance" "cluster_instances" {
  count              = 1
  identifier         = "aurora-instance-1"
  cluster_identifier = aws_rds_cluster.postgresql.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.postgresql.engine
  engine_version     = aws_rds_cluster.postgresql.engine_version
}
