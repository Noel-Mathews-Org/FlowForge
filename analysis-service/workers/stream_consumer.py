import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from redis.asyncio import Redis
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import settings
from models import AuditEvent, DailyTaskStats, UserActivityStats

logger = logging.getLogger(__name__)


async def _upsert_daily_stats(session: AsyncSession, *, event_type: str, event_date, project_id: str, metadata: dict):
    result = await session.execute(select(DailyTaskStats).where(and_(DailyTaskStats.date == event_date, DailyTaskStats.project_id == project_id)))
    stats = result.scalar_one_or_none()
    if not stats:
        stats = DailyTaskStats(date=event_date, project_id=project_id)
        session.add(stats)
    if event_type == "task_created":
        stats.tasks_created = (stats.tasks_created or 0) + 1
    elif event_type in ("task_moved", "approval_resolved"):
        new_status = metadata.get("new_status")
        if new_status == "DONE":
            stats.tasks_completed = (stats.tasks_completed or 0) + 1
        elif new_status == "IN_PROGRESS":
            stats.tasks_in_progress = (stats.tasks_in_progress or 0) + 1


async def _upsert_user_stats(session: AsyncSession, *, event_type: str, event_date, user_id: str, user_email: str, metadata: dict):
    result = await session.execute(select(UserActivityStats).where(and_(UserActivityStats.date == event_date, UserActivityStats.user_id == user_id)))
    stats = result.scalar_one_or_none()
    if not stats:
        stats = UserActivityStats(date=event_date, user_id=user_id, user_email=user_email)
        session.add(stats)
    stats.events_count = (stats.events_count or 0) + 1
    stats.user_email = user_email
    if event_type == "task_created":
        stats.tasks_created = (stats.tasks_created or 0) + 1
    if event_type == "task_moved" and metadata.get("new_status") == "DONE":
        stats.tasks_completed = (stats.tasks_completed or 0) + 1


async def consume_stream(redis_client: Redis, session_factory: async_sessionmaker):
    try:
        await redis_client.xgroup_create(name="audit_log", groupname=settings.STREAM_CONSUMER_GROUP, id="0", mkstream=True)
    except Exception as exc:  # noqa: BLE001
        if "BUSYGROUP" not in str(exc):
            logger.exception("Failed creating consumer group: %s", exc)

    while True:
        try:
            messages = await redis_client.xreadgroup(
                groupname=settings.STREAM_CONSUMER_GROUP,
                consumername=settings.STREAM_CONSUMER_NAME,
                streams={"audit_log": ">"},
                count=10,
                block=1000,
            )
            if not messages:
                await asyncio.sleep(0)
                continue
            for _, stream_messages in messages:
                for message_id, fields in stream_messages:
                    await _process_message(redis_client, session_factory, message_id, fields)
        except Exception:  # noqa: BLE001
            logger.exception("Stream consumer loop error")


async def _process_message(redis_client: Redis, session_factory: async_sessionmaker, message_id: str, fields: dict):
    async with session_factory() as session:
        try:
            metadata = json.loads(fields.get("metadata", "{}"))
            occurred_at_str = fields.get("timestamp")
            occurred_at = datetime.fromisoformat(occurred_at_str.replace("Z", "+00:00")) if occurred_at_str else datetime.now(timezone.utc)
            event_type = fields.get("event_type", "unknown")
            user_id = fields.get("user_id", "")
            user_email = fields.get("user_email", "")
            project_id = fields.get("project_id") or None
            task_id = fields.get("task_id") or None
            event_date = occurred_at.date()

            session.add(
                AuditEvent(
                    id=uuid4(),
                    event_type=event_type,
                    user_id=user_id,
                    user_email=user_email,
                    project_id=project_id,
                    task_id=task_id,
                    event_metadata=metadata,
                    occurred_at=occurred_at,
                )
            )
            if project_id:
                await _upsert_daily_stats(session, event_type=event_type, event_date=event_date, project_id=project_id, metadata=metadata)
            if user_id:
                await _upsert_user_stats(session, event_type=event_type, event_date=event_date, user_id=user_id, user_email=user_email, metadata=metadata)

            await session.commit()
            await redis_client.xack("audit_log", settings.STREAM_CONSUMER_GROUP, message_id)
        except Exception:  # noqa: BLE001
            await session.rollback()
            logger.exception("Failed processing stream message %s", message_id)
            # Acknowledge the message even on failure to prevent "poison pills" from clogging the PEL.
            # In a production system, this could instead push to a Dead Letter Queue (DLQ).
            await redis_client.xack("audit_log", settings.STREAM_CONSUMER_GROUP, message_id)
