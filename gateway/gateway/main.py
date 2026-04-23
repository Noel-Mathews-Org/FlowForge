import logging
import time
import uuid
from typing import Any

import aioredis
import httpx
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from auth import validate_jwt
from config import get_settings
from proxy import forward_request, get_upstream_url
from rate_limit import check_rate_limit, get_rate_limit_headers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [gateway] %(message)s",
)
logger = logging.getLogger("gateway")

app = FastAPI(title="FlowForge API Gateway", version="1.0.0")
settings = get_settings()

PUBLIC_ROUTES = {
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/register"),
    ("GET", "/api/auth/public-key"),
    ("GET", "/health"),
}

ERROR_CODE_MAP = {
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
    status.HTTP_502_BAD_GATEWAY: "BAD_GATEWAY",
    status.HTTP_504_GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "X-Request-ID"],
)


def _error_payload(code: str, message: str, request_id: str) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id,
        }
    }


def _is_public_route(request: Request) -> bool:
    return (request.method.upper(), request.url.path) in PUBLIC_ROUTES


def _extract_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    token = auth_header.replace("Bearer ", "", 1).strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return token


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    request.state.user_id = "anonymous"
    request.state.rate_limit_headers = {}

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    user_id = getattr(request.state, "user_id", "anonymous")
    logger.info(
        "%s %s status=%s duration_ms=%s user_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        user_id,
    )
    return response


@app.exception_handler(HTTPException)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    code = ERROR_CODE_MAP.get(exc.status_code, "BAD_GATEWAY")
    payload = _error_payload(code, str(exc.detail), request_id)
    headers = getattr(exc, "headers", None) or {}
    response = JSONResponse(status_code=exc.status_code, content=payload, headers=headers)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    payload = _error_payload("NOT_FOUND", "Invalid request", request_id)
    response = JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=payload)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled gateway error: %s", exc)
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    payload = _error_payload("BAD_GATEWAY", "Internal gateway error", request_id)
    response = JSONResponse(status_code=status.HTTP_502_BAD_GATEWAY, content=payload)
    response.headers["X-Request-ID"] = request_id
    return response


@app.on_event("startup")
async def on_startup() -> None:
    app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    await app.state.redis.ping()
    app.state.http_client = httpx.AsyncClient()
    logger.info("Gateway ready")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    redis_client = getattr(app.state, "redis", None)
    if redis_client is not None:
        await redis_client.close()
        wait_closed = getattr(redis_client, "wait_closed", None)
        if callable(wait_closed):
            await wait_closed()

    http_client = getattr(app.state, "http_client", None)
    if http_client is not None:
        await http_client.aclose()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "gateway", "version": "1.0.0"}


@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def gateway_handler(full_path: str, request: Request) -> Response:
    _ = full_path
    is_public = _is_public_route(request)
    payload = {}

    if not is_public:
        token = _extract_bearer_token(request)
        payload = validate_jwt(token)
        request.state.user_id = payload["sub"]

    identifier = payload["sub"] if payload else _client_ip(request)
    await check_rate_limit(identifier=identifier, redis_client=app.state.redis)
    request.state.rate_limit_headers = get_rate_limit_headers()

    upstream_url = get_upstream_url(request.url.path)
    injected_headers = {}
    if payload:
        injected_headers = {
            "X-User-ID": str(payload.get("sub", "")),
            "X-User-Role": str(payload.get("role", "")),
            "X-User-Email": str(payload.get("email", "")),
            "X-User-Org": str(payload.get("org", "")),
        }

    response = await forward_request(request, upstream_url, injected_headers)
    for key, value in request.state.rate_limit_headers.items():
        response.headers[key] = value
    return response
