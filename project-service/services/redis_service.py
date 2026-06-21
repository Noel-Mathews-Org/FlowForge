import json
from datetime import datetime, timezone
from typing import Any

from redis.asyncio import Redis

from config import settings

redis_client: Redis | None = None


async def connect_redis() -> None:
    global redis_client
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)


def get_redis() -> Redis | None:
    return redis_client


async def close_redis() -> None:
    global redis_client
    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None


async def publish_manager_notification(payload: dict[str, Any]) -> None:
    if redis_client is None:
        return
    await redis_client.publish(f"{settings.redis_prefix}notify.manager", json.dumps(payload))


async def publish_user_notification(requester_id: str, payload: dict[str, Any]) -> None:
    if redis_client is None:
        return
    await redis_client.publish(f"{settings.redis_prefix}notify.user.{requester_id}", json.dumps(payload))


async def append_audit_log(event_type: str, user_id: str, project_id: str, metadata: dict[str, Any]) -> None:
    if redis_client is None:
        return
    await redis_client.xadd(
        f"{settings.redis_prefix}audit_log",
        fields={
            "event_type": event_type,
            "user_id": user_id,
            "project_id": project_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": json.dumps(metadata),
        },
    )