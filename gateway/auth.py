import jwt
from fastapi import HTTPException, status
from jwt import ExpiredSignatureError, InvalidTokenError

from config import get_settings


def validate_jwt(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.public_key,
            algorithms=["RS256"],
            options={"require": ["exp", "sub", "email", "role", "org"]},
        )
        return payload
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        ) from exc
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc
