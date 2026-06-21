import json
from collections.abc import AsyncGenerator

from redis.asyncio import Redis

from config import settings

_redis_client: Redis | None = None


def get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def publish_event(channel: str, payload: dict) -> None:
    redis = get_redis()
    await redis.publish(f"{settings.redis_prefix}{channel}", json.dumps(payload))


async def subscribe_to_channel(channel: str) -> AsyncGenerator[str, None]:
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"{settings.redis_prefix}{channel}")
    try:
        async for message in pubsub.listen():
            if message.get("type") == "message":
                data = message.get("data")
                if isinstance(data, bytes):
                    yield data.decode("utf-8")
                else:
                    yield str(data)
    finally:
        await pubsub.unsubscribe(f"{settings.redis_prefix}{channel}")
        await pubsub.aclose()


async def append_audit_log(event_type: str, user_id: str, metadata: dict) -> None:
    redis = get_redis()
    from datetime import datetime, timezone
    await redis.xadd(
        f"{settings.redis_prefix}audit_log",
        fields={
            "event_type": event_type,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": json.dumps(metadata),
        },
    )