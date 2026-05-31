import os


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    if not DATABASE_URL:
        raise RuntimeError("Missing required environment variable: DATABASE_URL")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    APP_PORT: int = int(os.getenv("APP_PORT", "8004"))
    STREAM_CONSUMER_GROUP: str = os.getenv("STREAM_CONSUMER_GROUP", "analytics-group")
    STREAM_CONSUMER_NAME: str = os.getenv("STREAM_CONSUMER_NAME", "analytics-worker-1")
    INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "")


settings = Settings()

