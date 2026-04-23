from datetime import UTC, datetime, timedelta

import jwt

from config import settings
from models import User


def sign_jwt(user: User) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "org": user.org,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_expiry_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.private_key, algorithm="RS256")


def verify_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.public_key, algorithms=["RS256"])
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid token") from exc
