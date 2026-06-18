param (
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$true)]
    [string]$Location,
    
    [Parameter(Mandatory=$true)]
    [string]$KeyVaultName,
    
    [Parameter(Mandatory=$true)]
    [string]$StorageAccountName,
    
    [Parameter(Mandatory=$true)]
    [string]$AksVmSize
)

Write-Host "Starting Pre-flight checks..."

# Set Subscription
Write-Host "Setting active subscription to $SubscriptionId..."
az account set --subscription $SubscriptionId

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set subscription."
    exit 1
}

# 1. Check Key Vault Name Availability
Write-Host "Checking Key Vault name availability for: $KeyVaultName..."
$kvCheck = az keyvault check-name --name $KeyVaultName | ConvertFrom-Json

if ($kvCheck.nameAvailable -eq $false) {
    Write-Error "Key Vault name '$KeyVaultName' is not available. Reason: $($kvCheck.reason). Message: $($kvCheck.message)"
    exit 1
}
Write-Host "Key Vault name is available.`n"

# 2. Check Storage Account Name Availability
Write-Host "Checking Storage Account name availability for: $StorageAccountName..."
$saCheck = az storage account check-name --name $StorageAccountName | ConvertFrom-Json

if ($saCheck.nameAvailable -eq $false) {
    Write-Error "Storage Account name '$StorageAccountName' is not available. Reason: $($saCheck.reason). Message: $($saCheck.message)"
    exit 1
}
Write-Host "Storage Account name is available.`n"

# 3. Check VM Size Quota/Availability
Write-Host "Checking availability of VM Size '$AksVmSize' in location '$Location'..."
$vmSizes = az vm list-skus --location $Location --size $AksVmSize --all --output json | ConvertFrom-Json

if ($vmSizes.Count -eq 0) {
    Write-Error "VM Size '$AksVmSize' was not found in location '$Location'."
    exit 1
}

$vmSizeInfo = $vmSizes | Where-Object { $_.name -eq $AksVmSize -and $_.resourceType -eq 'virtualMachines' }

if ($null -eq $vmSizeInfo) {
    Write-Error "VM Size '$AksVmSize' is not available in location '$Location'."
    exit 1
}

# Check restrictions (e.g., NotAvailableForSubscription)
if ($vmSizeInfo.restrictions.Count -gt 0) {
    $restrictionTypes = $vmSizeInfo.restrictions.type -join ", "
    Write-Error "VM Size '$AksVmSize' has restrictions in location '$Location'. Restrictions: $restrictionTypes."
    exit 1
}

Write-Host "VM Size '$AksVmSize' is available in '$Location'.`n"

Write-Host "All pre-flight checks passed successfully! You can proceed with terraform apply."
exit 0
