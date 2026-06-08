terraform {
  backend "s3" {
    bucket         = "tfstate-flowforge-aws"
    key            = "aws/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    use_lockfile   = true
  }
}
