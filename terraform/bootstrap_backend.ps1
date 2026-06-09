# ==============================================================================
# BOOTSTRAP TERRAFORM BACKENDS
# Run this script ONCE before running `terraform init` to create the remote state.
# ==============================================================================

Write-Host "Starting Azure Backend Bootstrapping..." -ForegroundColor Cyan

$RESOURCE_GROUP_NAME = "rg-terraform-state"
$LOCATION = "centralindia"

# Generate a random string to ensure names are globally unique
$RANDOM_SUFFIX = -join ((97..122) | Get-Random -Count 6 | % {[char]$_})

$STORAGE_ACCOUNT_NAME = "sttfstateflowforge$RANDOM_SUFFIX"
$CONTAINER_NAME = "tfstate"

# Create Azure Resource Group
Write-Host "Creating Azure Resource Group: $RESOURCE_GROUP_NAME"
az group create --name $RESOURCE_GROUP_NAME --location $LOCATION

# Create Azure Storage Account
Write-Host "Creating Azure Storage Account: $STORAGE_ACCOUNT_NAME"
az storage account create `
    --resource-group $RESOURCE_GROUP_NAME `
    --name $STORAGE_ACCOUNT_NAME `
    --sku Standard_LRS `
    --encryption-services blob

# Create Azure Blob Container
Write-Host "Creating Blob Container: $CONTAINER_NAME"
# Get Storage Account Key
$ACCOUNT_KEY = $(az storage account keys list --resource-group $RESOURCE_GROUP_NAME --account-name $STORAGE_ACCOUNT_NAME --query '[0].value' -o tsv)
az storage container create --name $CONTAINER_NAME --account-name $STORAGE_ACCOUNT_NAME --account-key $ACCOUNT_KEY

Write-Host "Azure Backend successfully created!" -ForegroundColor Green
Write-Host "----------------------------------------"

Write-Host "Starting AWS Backend Bootstrapping..." -ForegroundColor Cyan

$AWS_REGION = "ap-south-1"
$S3_BUCKET_NAME = "tfstate-flowforge-aws-$RANDOM_SUFFIX"
$DYNAMODB_TABLE_NAME = "terraform-lock"

# Create AWS S3 Bucket
Write-Host "Creating AWS S3 Bucket: $S3_BUCKET_NAME"
aws s3api create-bucket `
    --bucket $S3_BUCKET_NAME `
    --region $AWS_REGION `
    --create-bucket-configuration LocationConstraint=$AWS_REGION

# Enable Versioning on S3 Bucket
Write-Host "Enabling Versioning on S3 Bucket"
aws s3api put-bucket-versioning `
    --bucket $S3_BUCKET_NAME `
    --versioning-configuration Status=Enabled

# Create DynamoDB Table for State Locking
Write-Host "Creating DynamoDB Table: $DYNAMODB_TABLE_NAME"
aws dynamodb create-table `
    --table-name $DYNAMODB_TABLE_NAME `
    --attribute-definitions AttributeName=LockID,AttributeType=S `
    --key-schema AttributeName=LockID,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region $AWS_REGION

Write-Host "AWS Backend successfully created!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "To initialize Terraform for Azure, run:"
Write-Host "terraform init -backend-config=`"resource_group_name=$RESOURCE_GROUP_NAME`" -backend-config=`"storage_account_name=$STORAGE_ACCOUNT_NAME`" -backend-config=`"container_name=$CONTAINER_NAME`" -backend-config=`"key=azure-prod.terraform.tfstate`""
Write-Host ""
Write-Host "To initialize Terraform for AWS, run:"
Write-Host "terraform init -backend-config=`"bucket=$S3_BUCKET_NAME`" -backend-config=`"key=aws-prod.terraform.tfstate`" -backend-config=`"region=$AWS_REGION`" -backend-config=`"dynamodb_table=$DYNAMODB_TABLE_NAME`""
Write-Host ""
