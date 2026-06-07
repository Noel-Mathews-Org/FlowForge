import os

# Load secrets from Azure Key Vault before reading env vars
try:
    from keyvault import apply_keyvault_secrets
    apply_keyvault_secrets()
except Exception:
    pass  # Key Vault is optional


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    if not DATABASE_URL:
        raise RuntimeError("Missing required environment variable: DATABASE_URL")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    APP_PORT: int = int(os.getenv("APP_PORT", "8004"))
    STREAM_CONSUMER_GROUP: str = os.getenv("STREAM_CONSUMER_GROUP", "analytics-group")
    STREAM_CONSUMER_NAME: str = os.getenv("STREAM_CONSUMER_NAME", "analytics-worker-1")
    INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "")

    # ── Azure AI Foundry ──
    AZURE_FOUNDRY_ENDPOINT: str = os.getenv("AZURE_FOUNDRY_ENDPOINT", "")
    AZURE_FOUNDRY_KEY: str = os.getenv("AZURE_FOUNDRY_KEY", "")
    AZURE_FOUNDRY_DEPLOYMENT: str = os.getenv("AZURE_FOUNDRY_DEPLOYMENT", "summary-agent")
    AZURE_FOUNDRY_USE_MANAGED_IDENTITY: bool = os.getenv("AZURE_FOUNDRY_USE_MANAGED_IDENTITY", "false").lower() == "true"

    # ── Azure Blob Storage ──
    AZURE_STORAGE_CONNECTION_STRING: str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
    AZURE_STORAGE_ACCOUNT_NAME: str = os.getenv("AZURE_STORAGE_ACCOUNT_NAME", "")
    AZURE_STORAGE_USE_MANAGED_IDENTITY: bool = os.getenv("AZURE_STORAGE_USE_MANAGED_IDENTITY", "false").lower() == "true"
    AZURE_STORAGE_CONTAINER: str = os.getenv("AZURE_STORAGE_CONTAINER", "flowforge-reports")

    # ── Azure Key Vault (optional) ──
    AZURE_KEYVAULT_URL: str = os.getenv("AZURE_KEYVAULT_URL", "")

    # ── SMTP ──
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "FlowForge")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", ""))

    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")


settings = Settings()
