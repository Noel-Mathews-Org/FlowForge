from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware


class HeaderExtractionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = request.headers.get("X-User-ID")
        request.state.user_role = request.headers.get("X-User-Role")
        request.state.user_email = request.headers.get("X-User-Email")
        request.state.org_id = request.headers.get("X-Org-ID")
        return await call_next(request)


def require_role(*roles: str):
    allowed = {r.lower() for r in roles}

    def checker(request: Request) -> None:
        role = (getattr(request.state, "user_role", "") or "").lower()
        if role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")

    return Depends(checker)
