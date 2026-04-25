import os


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise RuntimeError("Missing required environment variable: DATABASE_URL")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    APP_PORT: int = int(os.getenv("APP_PORT", "8003"))


settings = Settings()
