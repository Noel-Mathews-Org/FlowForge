import os
from dataclasses import dataclass

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def _parse_int(name: str, default: int) -> int:
    value = os.getenv(name, str(default))
    try:
        return int(value)
    except ValueError:
        return default


def _generate_rsa_key_pair() -> tuple[str, str]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    print("\n=== FLOWFORGE AUTH GENERATED RSA KEYS ===")
    print("PRIVATE_KEY (put in auth-service .env):")
    print(private_pem)
    print("PUBLIC_KEY (put in auth-service and gateway .env):")
    print(public_pem)
    print("=== END GENERATED RSA KEYS ===\n")

    return private_pem, public_pem


@dataclass(frozen=True)
class Settings:
    database_url: str
    redis_url: str
    private_key: str
    public_key: str
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
    private_key = os.getenv("PRIVATE_KEY", "").strip()
    public_key = os.getenv("PUBLIC_KEY", "").strip()

    if not private_key:
        private_key, generated_public_key = _generate_rsa_key_pair()
        if not public_key:
            public_key = generated_public_key

    return Settings(
        database_url=os.getenv(
            "DATABASE_URL", "postgresql+asyncpg://user:pass@postgres:5432/auth_db"
        ),
        redis_url=os.getenv("REDIS_URL", "redis://redis:6379"),
        private_key=private_key,
        public_key=public_key,
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
