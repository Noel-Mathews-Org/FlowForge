import os
import secrets
from dataclasses import dataclass


def _parse_int(name: str, default: int) -> int:
    value = os.getenv(name, str(default))
    try:
        return int(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    database_url: str
    redis_url: str
    jwt_secret: str
    jwt_expiry_hours: int
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    smtp_from_name: str
    smtp_from_email: str
    frontend_url: str
    app_port: int


def _build_settings() -> Settings:
    jwt_secret = os.getenv("JWT_SECRET", "").strip()
    if not jwt_secret:
        raise RuntimeError("Missing required environment variable: JWT_SECRET")

    return Settings(
        database_url=os.getenv("DATABASE_URL"),
        redis_url=os.getenv("REDIS_URL", "redis://redis:6379"),
        jwt_secret=jwt_secret,
        jwt_expiry_hours=_parse_int("JWT_EXPIRY_HOURS", 24),
        smtp_host=os.getenv("SMTP_HOST", "smtp.gmail.com"),
        smtp_port=_parse_int("SMTP_PORT", 587),
        smtp_username=os.getenv("SMTP_USERNAME", ""),
        smtp_password=os.getenv("SMTP_PASSWORD", ""),
        smtp_from_name=os.getenv("SMTP_FROM_NAME", "FlowForge"),
        smtp_from_email=os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", "")),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000"),
        app_port=_parse_int("APP_PORT", 8001),
    )


settings = _build_settings()
