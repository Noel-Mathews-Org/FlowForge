import time
import uuid
from contextvars import ContextVar

from fastapi import HTTPException, status

from config import get_settings

_remaining_ctx: ContextVar[int] = ContextVar("rate_limit_remaining", default=0)
_reset_ctx: ContextVar[int] = ContextVar("rate_limit_reset", default=0)


async def check_rate_limit(identifier: str, redis_client) -> None:
    settings = get_settings()
    now = time.time()
    window_start = now - settings.rate_limit_window_seconds
    key = f"rl:{identifier}"
    member = f"{now}:{uuid.uuid4().hex}"

    async with redis_client.pipeline(transaction=True) as pipeline:
        (
            pipeline.zadd(key, {member: now})
            .zremrangebyscore(key, 0, window_start)
            .zcard(key)
            .expire(key, settings.rate_limit_window_seconds)
        )
        _, _, count, _ = await pipeline.execute()

    reset_ts = int(now + settings.rate_limit_window_seconds)
    remaining = max(settings.rate_limit_requests - int(count), 0)
    _remaining_ctx.set(remaining)
    _reset_ctx.set(reset_ts)

    if int(count) > settings.rate_limit_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={
                "X-RateLimit-Limit": str(settings.rate_limit_requests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_ts),
            },
        )


def get_rate_limit_headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "X-RateLimit-Limit": str(settings.rate_limit_requests),
        "X-RateLimit-Remaining": str(_remaining_ctx.get()),
        "X-RateLimit-Reset": str(_reset_ctx.get()),
    }
