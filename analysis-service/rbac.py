from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware


class HeaderExtractionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = request.headers.get("X-User-ID")
        request.state.user_role = request.headers.get("X-User-Role")
        request.state.user_email = request.headers.get("X-User-Email")
        return await call_next(request)


def require_role(*allowed_roles: str):
    allowed = {role.lower() for role in allowed_roles}

    def dependency(request: Request):
        role = (request.state.user_role or "").lower()
        if role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role permissions")
        return role

    return Depends(dependency)
