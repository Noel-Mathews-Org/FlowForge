import logging
import os

logger = logging.getLogger(__name__)

# Map Key Vault secret names → env var names
SECRET_MAP = {
    "jwt-secret": "JWT_SECRET",
    "internal-api-key": "INTERNAL_API_KEY",
    "entra-client-secret": "ENTRA_CLIENT_SECRET",
    "entra-tenant-id": "ENTRA_TENANT_ID",
    "entra-client-id": "ENTRA_CLIENT_ID",
    "smtp-host": "SMTP_HOST",
    "smtp-username": "SMTP_USERNAME",
    "smtp-password": "SMTP_PASSWORD",
    "redis-url": "REDIS_URL",
    "entra-group-platform-admin": "ENTRA_GROUP_PLATFORM_ADMIN",
    "entra-group-org-owner": "ENTRA_GROUP_ORG_OWNER",
    "entra-group-manager": "ENTRA_GROUP_MANAGER",
    "entra-group-member": "ENTRA_GROUP_MEMBER",
}


def load_secrets_from_keyvault(vault_url: str | None = None) -> dict[str, str]:
    """
    Load secrets from Azure Key Vault using Managed Identity (DefaultAzureCredential).
    Returns a dict of {env_var_name: secret_value}.
    If Key Vault is unavailable, returns an empty dict (graceful fallback).
    """
    if not vault_url:
        vault_url = os.getenv("AZURE_KEYVAULT_URL", "")
    if not vault_url:
        return {}

    try:
        from azure.keyvault.secrets import SecretClient
        from azure.identity import DefaultAzureCredential
    except ImportError:
        logger.warning("azure-keyvault-secrets or azure-identity not installed, skipping Key Vault")
        return {}

    secrets = {}
    try:
        credential = DefaultAzureCredential()
        client = SecretClient(vault_url=vault_url, credential=credential)

        for kv_name, env_name in SECRET_MAP.items():
            try:
                secret = client.get_secret(kv_name)
                if secret.value:
                    secrets[env_name] = secret.value
            except Exception:
                # Secret might not exist in this vault — that's fine
                pass

        logger.info("Loaded %d secrets from Key Vault (%s)", len(secrets), vault_url)
    except Exception as exc:
        logger.warning("Key Vault unavailable (%s): %s", vault_url, exc)

    return secrets


def apply_keyvault_secrets(vault_url: str | None = None) -> None:
    """
    Load secrets from Key Vault and inject them into os.environ.
    Existing env vars are NOT overwritten (env vars take precedence).
    """
    secrets = load_secrets_from_keyvault(vault_url)
    for env_name, value in secrets.items():
        if not os.getenv(env_name):
            os.environ[env_name] = value
