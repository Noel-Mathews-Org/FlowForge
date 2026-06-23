import json
from datetime import datetime, timezone
from typing import Any

from redis.asyncio import Redis


class RedisAuditService:
    def __init__(self, redis_client: Redis):
        self.redis_client = redis_client

    async def emit_event(
        self,
        *,
        event_type: str,
        user_id: str,
        user_email: str,
        project_id: str | None,
        task_id: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        from config import settings
        await self.redis_client.xadd(
            f"{settings.redis_prefix}audit_log",
            {
                "event_type": event_type,
                "user_id": user_id,
                "user_email": user_email,
                "project_id": project_id or "",
                "task_id": task_id or "",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": json.dumps(metadata or {}),
            },
        )
