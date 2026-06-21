#!/bin/bash

# Default values
VAULT_NAME=""
ENV_FILE="secrets.env"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -v|--vault-name) VAULT_NAME="$2"; shift ;;
        -f|--file) ENV_FILE="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name is required."
    echo "Usage: ./upload_secrets.sh -v <vault-name> [-f <env-file>]"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Could not find file '$ENV_FILE'. Please copy 'secrets.env.template' to 'secrets.env', fill in your values, and run this script again."
    exit 1
fi

echo "Reading secrets from $ENV_FILE and uploading to Key Vault: $VAULT_NAME..."

while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip empty lines and comments
    if [[ -z "$key" ]] || [[ "$key" == \#* ]]; then
        continue
    fi

    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)

    if [ -z "$value" ]; then
        echo -e "\e[33mSkipping '$key' - value is empty.\e[0m"
        continue
    fi

    echo -n "Processing secret: $key ... "
    
    # Check current value to skip if identical
    CURRENT_VALUE=$(az keyvault secret show --vault-name "$VAULT_NAME" --name "$key" --query value -o tsv 2>/dev/null || echo "")
    
    if [ "$CURRENT_VALUE" == "$value" ]; then
        echo -e "\e[33mSkipped (Value unchanged).\e[0m"
        continue
    fi
    
    # Upload new value and capture the new version ID
    echo -n "Updating... "
    NEW_VERSION_ID=$(az keyvault secret set --vault-name "$VAULT_NAME" --name "$key" --value "$value" --query "id" -o tsv 2>/dev/null)
    
    if [ -n "$NEW_VERSION_ID" ]; then
        # Fetch all currently enabled versions for this secret
        ALL_VERSIONS=$(az keyvault secret list-versions --vault-name "$VAULT_NAME" --name "$key" --query "[?attributes.enabled].id" -o tsv)
        
        # Disable older versions
        for version_url in $ALL_VERSIONS; do
            # Compare using bash string comparison
            if [ "$version_url" != "$NEW_VERSION_ID" ]; then
                az keyvault secret set-attributes --id "$version_url" --enabled false > /dev/null 2>&1
            fi
        done
        
        echo -e "\e[32mDone (Updated & old versions disabled).\e[0m"
    else
        echo -e "\e[31mFailed.\e[0m"
        # Run again to show the user the explicit error message
        az keyvault secret set --vault-name "$VAULT_NAME" --name "$key" --value "$value"
    fi

done < "$ENV_FILE"

echo -e "\e[36mAll done!\e[0m"
