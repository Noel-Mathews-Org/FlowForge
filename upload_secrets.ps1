param (
    [Parameter(Mandatory=$true)]
    [string]$VaultName,
    
    [Parameter(Mandatory=$false)]
    [string]$EnvFile = "secrets.env"
)

if (-Not (Test-Path $EnvFile)) {
    Write-Error "Could not find file '$EnvFile'. Please copy 'secrets.env.template' to 'secrets.env', fill in your values, and run this script again."
    exit 1
}

Write-Host "Reading secrets from $EnvFile and uploading to Key Vault: $VaultName..."

foreach ($line in Get-Content $EnvFile) {
    # Skip empty lines and comments
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
        continue
    }

    # Split on the first equals sign
    $parts = $line -split '=', 2
    if ($parts.Length -eq 2) {
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-Host "Skipping '$key' - value is empty." -ForegroundColor Yellow
            continue
        }

        Write-Host "Uploading secret: $key ..." -NoNewline
        
        # Run az cli command
        $output = az keyvault secret set --vault-name $VaultName --name $key --value $value 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " Done." -ForegroundColor Green
        } else {
            Write-Host " Failed." -ForegroundColor Red
            Write-Host $output -ForegroundColor Red
        }
    }
}

Write-Host "All done!" -ForegroundColor Cyan
