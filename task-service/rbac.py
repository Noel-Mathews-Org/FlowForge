from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware


class HeaderExtractionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = request.headers.get("X-User-ID")
        request.state.user_role = request.headers.get("X-User-Role")
        request.state.user_email = request.headers.get("X-User-Email")
        return await call_next(request)


def get_current_user_id(x_user_id: str = Header(..., alias="X-User-ID")) -> UUID:
    try:
        return UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-User-ID") from exc


def require_role(*allowed_roles: str):
    allowed = {role.lower() for role in allowed_roles}

    def dependency(request: Request):
        role = (request.state.user_role or "").lower()
        if role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role permissions")
        return role

    return Depends(dependency)
