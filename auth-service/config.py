import os

# Load secrets from Azure Key Vault before reading env vars
try:
    from keyvault import apply_keyvault_secrets
    apply_keyvault_secrets()
except Exception:
    pass  # Key Vault is optional


def _parse_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


class Settings:
    def __init__(self) -> None:
        self.jwt_secret = os.getenv("JWT_SECRET", "").strip()
        if not self.jwt_secret:
            raise RuntimeError("Missing required environment variable: JWT_SECRET")

        self.internal_api_key = os.getenv("INTERNAL_API_KEY", "").strip()
        if not self.internal_api_key:
            raise RuntimeError("Missing required environment variable: INTERNAL_API_KEY")

        self.database_url: str = os.getenv("DATABASE_URL", "")
        self.redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379")
        self.jwt_expiry_hours: int = _parse_int("JWT_EXPIRY_HOURS", 1)
        self.refresh_token_days: int = _parse_int("REFRESH_TOKEN_DAYS", 7)

        # SMTP — optional; email disabled if host not set
        self.smtp_host: str = os.getenv("SMTP_HOST", "")
        self.smtp_port: int = _parse_int("SMTP_PORT", 587)
        self.smtp_username: str = os.getenv("SMTP_USERNAME", "")
        self.smtp_password: str = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "FlowForge")
        self.smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", ""))

        self.frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.app_port: int = _parse_int("APP_PORT", 8001)

        # Default organization ID for single-tenant setup
        self.default_org_id: str = os.getenv(
            "DEFAULT_ORG_ID", "00000000-0000-0000-0000-000000000001"
        )

        # ── Entra ID (Azure AD) — all optional, disabled if tenant_id not set ──
        self.entra_tenant_id: str = os.getenv("ENTRA_TENANT_ID", "")
        self.entra_client_id: str = os.getenv("ENTRA_CLIENT_ID", "")
        self.entra_client_secret: str = os.getenv("ENTRA_CLIENT_SECRET", "")
        self.entra_authority: str = (
            f"https://login.microsoftonline.com/{self.entra_tenant_id}"
            if self.entra_tenant_id else ""
        )
        self.entra_enabled: bool = bool(self.entra_tenant_id and self.entra_client_id)

        # Security Group Object IDs for RBAC mapping
        self.entra_group_platform_admin: str = os.getenv("ENTRA_GROUP_PLATFORM_ADMIN", "")
        self.entra_group_org_owner: str = os.getenv("ENTRA_GROUP_ORG_OWNER", "")
        self.entra_group_manager: str = os.getenv("ENTRA_GROUP_MANAGER", "")
        self.entra_group_member: str = os.getenv("ENTRA_GROUP_MEMBER", "")

        # Azure Key Vault (optional)
        self.azure_keyvault_url: str = os.getenv("AZURE_KEYVAULT_URL", "")


settings = Settings()
