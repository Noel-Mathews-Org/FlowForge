import os


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@postgres:5432/task_db",
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    APP_PORT: int = int(os.getenv("APP_PORT", "8003"))


settings = Settings()
