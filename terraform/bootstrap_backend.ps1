# ==============================================================================
# BOOTSTRAP TERRAFORM BACKENDS
# Run this script ONCE before running `terraform init` to create the remote state.
# ==============================================================================

Write-Host "Starting Azure Backend Bootstrapping..." -ForegroundColor Cyan

$RESOURCE_GROUP_NAME = "rg-terraform-state"
$STORAGE_ACCOUNT_NAME = "sttfstateflowforge"
$CONTAINER_NAME = "tfstate"
$LOCATION = "centralindia"

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
$S3_BUCKET_NAME = "tfstate-flowforge-aws"
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
Write-Host "You may now run 'terraform init' in both the azure and aws directories." -ForegroundColor Yellow
