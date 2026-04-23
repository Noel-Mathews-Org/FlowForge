from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware


class HeaderExtractionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = request.headers.get("X-User-ID")
        request.state.user_role = request.headers.get("X-User-Role")
        request.state.user_email = request.headers.get("X-User-Email")
        return await call_next(request)


def get_current_user_id(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authenticated user context",
        )
    return user_id


def require_role(*roles: str) -> Callable[[Request], None]:
    def checker(request: Request) -> None:
        user_role = getattr(request.state, "user_role", None)
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

    return Depends(checker)
