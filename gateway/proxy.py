import httpx
from fastapi import HTTPException, Request, status
from fastapi.responses import Response

from config import get_settings


def get_upstream_url(path: str) -> str:
    settings = get_settings()
    routes = {
        "/api/auth/": settings.auth_service_url,
        "/api/projects/": settings.project_service_url,
        "/api/tasks/": settings.task_service_url,
        "/api/analytics/": settings.analytics_service_url,
        "/api/ai/": settings.analytics_service_url,       # AI routes live in analysis-service
    }

    for prefix, base_url in routes.items():
        if path.startswith(prefix):
            return base_url.rstrip("/")

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Route not found",
    )


def _strip_api_prefix(path: str) -> str:
    """
    Removes only the /api prefix from the path.
    Example: /api/auth/login -> /auth/login
             /api/projects/  -> /projects/
    """
    if path.startswith("/api/"):
        return path[4:]  # Remove "/api", keep everything after
    return path



def _filter_request_headers(headers: dict[str, str]) -> dict[str, str]:
    excluded = {"authorization", "host", "content-length", "connection"}
    return {k: v for k, v in headers.items() if k.lower() not in excluded}


def _filter_response_headers(headers: httpx.Headers) -> dict[str, str]:
    excluded = {"content-length", "transfer-encoding", "connection", "content-encoding"}
    return {k: v for k, v in headers.items() if k.lower() not in excluded}


async def forward_request(request: Request, upstream_url: str, extra_headers: dict) -> Response:
    timeout = httpx.Timeout(30.0)
    stripped_path = _strip_api_prefix(request.url.path)
    url = f"{upstream_url}{stripped_path}"
    request_headers = _filter_request_headers(dict(request.headers))
    request_headers.update(extra_headers)
    body = await request.body()

    try:
        client: httpx.AsyncClient = request.app.state.http_client
        upstream_response = await client.request(
            method=request.method,
            url=url,
            params=request.query_params,
            content=body,
            headers=request_headers,
            timeout=timeout,
        )
    except httpx.ConnectTimeout as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Upstream timeout",
        ) from exc
    except httpx.ReadTimeout as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Upstream timeout",
        ) from exc
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream connection failed",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream request failed",
        ) from exc

    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        headers=_filter_response_headers(upstream_response.headers),
        media_type=upstream_response.headers.get("content-type"),
    )
