import json
from collections.abc import AsyncGenerator

import aioredis

from config import settings


_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


async def publish_event(channel: str, payload: dict) -> None:
    redis = get_redis()
    await redis.publish(channel, json.dumps(payload))


async def subscribe_to_channel(channel: str) -> AsyncGenerator[str, None]:
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message.get("type") == "message":
                data = message.get("data")
                if isinstance(data, bytes):
                    yield data.decode("utf-8")
                else:
                    yield str(data)
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
