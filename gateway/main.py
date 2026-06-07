import logging
import time
import uuid
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from redis.asyncio import Redis
from starlette.exceptions import HTTPException as StarletteHTTPException

from auth import validate_jwt
from config import get_settings
from proxy import forward_request, get_upstream_url
from rate_limit import check_rate_limit, get_rate_limit_headers

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [gateway] %(message)s")
logger = logging.getLogger("gateway")

app = FastAPI(title="FlowForge API Gateway", version="2.0.0")
settings = get_settings()

# ─── Public routes that skip JWT validation ───────────────────────────────────
PUBLIC_ROUTES = {
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/login/entra"),
    ("GET",  "/api/auth/invite/verify"),
    ("POST", "/api/auth/invite/accept"),
    ("POST", "/api/auth/refresh"),
    ("POST", "/api/auth/logout"),
    ("GET",  "/health"),
}

# Routes that a must_reset_password user can access (besides public routes)
FORCE_RESET_ALLOWED = {
    ("POST", "/api/auth/force-reset"),
    ("GET",  "/api/auth/me"),
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "X-Request-ID"],
)


def _error(code: str, message: str, request_id: str) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "request_id": request_id}}


def _is_public(request: Request) -> bool:
    return (request.method.upper(), request.url.path) in PUBLIC_ROUTES


def _is_force_reset_allowed(request: Request) -> bool:
    return (request.method.upper(), request.url.path) in FORCE_RESET_ALLOWED | PUBLIC_ROUTES


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    token = auth[7:].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return token


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else "unknown"


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request.state.request_id = str(uuid.uuid4())
    request.state.user_id = "anonymous"
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    logger.info("%s %s %s %.1fms user=%s",
        request.method, request.url.path, response.status_code,
        (time.perf_counter() - start) * 1000,
        getattr(request.state, "user_id", "anonymous"))
    return response


@app.exception_handler(HTTPException)
@app.exception_handler(StarletteHTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    rid = getattr(request.state, "request_id", str(uuid.uuid4()))
    codes = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 429: "RATE_LIMITED", 502: "BAD_GATEWAY", 504: "GATEWAY_TIMEOUT"}
    return JSONResponse(status_code=exc.status_code, content=_error(codes.get(exc.status_code, "ERROR"), str(exc.detail), rid))


@app.exception_handler(Exception)
async def unhandled_exc_handler(request: Request, exc: Exception):
    logger.exception("Unhandled gateway error: %s", exc)
    rid = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(status_code=502, content=_error("BAD_GATEWAY", "Internal gateway error", rid))


@app.on_event("startup")
async def on_startup():
    app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
    await app.state.redis.ping()
    app.state.http_client = httpx.AsyncClient()
    logger.info("Gateway ready — v2.0 (4-role system)")


@app.on_event("shutdown")
async def on_shutdown():
    if r := getattr(app.state, "redis", None):
        await r.aclose()
    if c := getattr(app.state, "http_client", None):
        await c.aclose()


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "gateway"}


@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def gateway_handler(full_path: str, request: Request) -> Response:
    _ = full_path
    payload: dict = {}

    if not _is_public(request):
        token = _extract_token(request)
        payload = validate_jwt(token)
        request.state.user_id = payload["sub"]

        # Force password reset: block all routes except allowed ones
        if payload.get("must_reset_password"):
            if not _is_force_reset_allowed(request):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Password reset required. Please reset your password at /force-reset."
                )

    identifier = payload.get("sub") or _client_ip(request)
    await check_rate_limit(identifier=identifier, redis_client=app.state.redis)

    upstream_url = get_upstream_url(request.url.path)
    injected: dict[str, str] = {}
    if payload:
        injected = {
            "X-User-ID":    str(payload.get("sub", "")),
            "X-User-Role":  str(payload.get("role", "")),
            "X-User-Email": str(payload.get("email", "")),
            "X-Org-ID":     str(payload.get("org_id", "")),
            "X-Must-Reset": str(payload.get("must_reset_password", False)),
        }

    return await forward_request(request, upstream_url, injected)
