import json
from datetime import datetime, timezone
from typing import Any

from redis.asyncio import Redis

from config import settings

redis_client = None


async def connect_redis() -> None:
    global redis_client
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)


async def close_redis() -> None:
    global redis_client
    if redis_client is not None:
        await redis_client.close()
        redis_client = None


async def publish_manager_notification(payload: dict[str, Any]) -> None:
    if redis_client is None:
        return
    await redis_client.publish("notify.manager", json.dumps(payload))


async def publish_user_notification(requester_id: str, payload: dict[str, Any]) -> None:
    if redis_client is None:
        return
    await redis_client.publish(f"notify.user.{requester_id}", json.dumps(payload))


async def append_audit_log(event_type: str, user_id: str, project_id: str, metadata: dict[str, Any]) -> None:
    if redis_client is None:
        return
    await redis_client.xadd(
        "audit_log",
        fields={
            "event_type": event_type,
            "user_id": user_id,
            "project_id": project_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": json.dumps(metadata),
        },
    )
