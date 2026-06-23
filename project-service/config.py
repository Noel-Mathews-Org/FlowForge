import os

try:
    from keyvault import apply_keyvault_secrets
    apply_keyvault_secrets()
except Exception:
    pass  # Key Vault is optional


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv("DATABASE_URL", "")
        if not self.database_url:
            raise RuntimeError("Missing required environment variable: DATABASE_URL")
        self.redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379")
        self.redis_prefix: str = os.getenv("REDIS_PREFIX", "")
        self.app_port: int = int(os.getenv("APP_PORT", "8002"))
        self.frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.internal_api_key: str = os.getenv("INTERNAL_API_KEY", "")
        self.default_org_id: str = os.getenv("DEFAULT_ORG_ID", "00000000-0000-0000-0000-000000000001")
        self.smtp_host: str = os.getenv("SMTP_HOST", "")
        self.smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username: str = os.getenv("SMTP_USERNAME", "")
        self.smtp_password: str = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "noreply@flowforge.local")
        self.smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "FlowForge")
        self.task_service_url: str = os.getenv("TASK_SERVICE_URL", "http://task-service:8003")


settings = Settings()
