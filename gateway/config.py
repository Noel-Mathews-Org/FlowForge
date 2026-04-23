import os
from dataclasses import dataclass
from typing import List


def _get_env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.getenv(name, default)
    if required and (value is None or value.strip() == ""):
        raise RuntimeError(f"Missing required environment variable: {name}")
    return (value or "").strip()


def _load_public_key() -> str:
    # Try file path first (preferred, avoids env var newline issues)
    key_path = os.getenv("PUBLIC_KEY_PATH", "/app/keys/public.pem")
    if os.path.exists(key_path):
        with open(key_path, "r") as f:
            return f.read().strip()
    # Fallback to env var with newline replacement
    key = os.getenv("PUBLIC_KEY", "").strip().replace("\\n", "\n")
    if not key:
        raise RuntimeError("No public key found: set PUBLIC_KEY_PATH or PUBLIC_KEY")
    return key


def _parse_origins(raw: str) -> List[str]:
    default_origin = "http://localhost:3000"
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()] if raw else [default_origin]
    
    public_ip = os.getenv("PUBLIC_IP")
    if public_ip:
        origins.append(f"http://{public_ip}:3000")
        origins.append(f"http://{public_ip}")
    
    if default_origin not in origins:
        origins.insert(0, default_origin)
    return list(set(origins))


@dataclass(frozen=True)
class Settings:
    public_key: str
    redis_url: str
    auth_service_url: str
    project_service_url: str
    task_service_url: str
    analytics_service_url: str
    rate_limit_requests: int
    rate_limit_window_seconds: int
    gateway_port: int
    allowed_origins: List[str]


def get_settings() -> Settings:
    return Settings(
        public_key=_load_public_key(),
        redis_url=_get_env("REDIS_URL", "redis://redis:6379"),
        auth_service_url=_get_env("AUTH_SERVICE_URL", "http://auth-service:8001"),
        project_service_url=_get_env("PROJECT_SERVICE_URL", "http://project-service:8002"),
        task_service_url=_get_env("TASK_SERVICE_URL", "http://task-service:8003"),
        analytics_service_url=_get_env("ANALYTICS_SERVICE_URL", "http://analytics-service:8004"),
        rate_limit_requests=int(_get_env("RATE_LIMIT_REQUESTS", "100")),
        rate_limit_window_seconds=int(_get_env("RATE_LIMIT_WINDOW_SECONDS", "60")),
        gateway_port=int(_get_env("GATEWAY_PORT", "8000")),
        allowed_origins=_parse_origins(_get_env("ALLOWED_ORIGINS", "http://localhost:3000")),
    )