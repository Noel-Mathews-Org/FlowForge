import os


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@postgres:5432/analytics_db",
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    APP_PORT: int = int(os.getenv("APP_PORT", "8004"))
    STREAM_CONSUMER_GROUP: str = os.getenv("STREAM_CONSUMER_GROUP", "analytics-group")
    STREAM_CONSUMER_NAME: str = os.getenv("STREAM_CONSUMER_NAME", "analytics-worker-1")


settings = Settings()
