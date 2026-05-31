import os


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv("DATABASE_URL", "")
        if not self.database_url:
            raise RuntimeError("Missing required: DATABASE_URL")
        self.redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379")
        self.app_port: int = int(os.getenv("APP_PORT", "8003"))
        self.internal_api_key: str = os.getenv("INTERNAL_API_KEY", "")


settings = Settings()
