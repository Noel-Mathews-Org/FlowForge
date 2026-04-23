import os


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@postgres:5432/project_db",
        )
        self.redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379")
        self.app_port: int = int(os.getenv("APP_PORT", "8002"))
        self.frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")


settings = Settings()
