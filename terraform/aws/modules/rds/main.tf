# RDS Requires at least 2 subnets in different AZs for a Subnet Group
resource "aws_subnet" "dummy_private" {
  vpc_id            = var.vpc_id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.region}b"
  tags = {
    Name = "subnet-private-dummy-db"
  }
}

resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "rds-subnet-group"
  subnet_ids = [var.private_subnet_id, aws_subnet.dummy_private.id]
}

resource "aws_db_instance" "postgresql" {
  identifier             = "database-1"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.micro" # Free Tier eligible
  allocated_storage      = 20             # Free Tier maximum
  storage_type           = "gp2"          # General Purpose SSD
  
  db_name                = "flowforge"
  username               = "noelmc"
  password               = "Niamc12345"
  
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
  vpc_security_group_ids = [var.db_security_group_id]
  
  publicly_accessible    = false
  skip_final_snapshot    = true
  
  # Ensure it doesn't auto-upgrade major versions
  auto_minor_version_upgrade = true
}
