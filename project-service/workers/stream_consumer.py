import asyncio
import json
import logging
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from config import settings
from models import ProjectMember
from services.email_service import send_task_notification_email

logger = logging.getLogger(__name__)

async def _notify_members(session_factory: async_sessionmaker, project_id: str, subject: str, message: str):
    try:
        project_uuid = UUID(project_id)
        async with session_factory() as session:
            result = await session.execute(select(ProjectMember).where(ProjectMember.project_id == project_uuid))
            members = result.scalars().all()
            for member in members:
                await send_task_notification_email(member.user_email, subject, message, message)
    except Exception as exc:
        logger.exception("Failed to notify members for project %s: %s", project_id, exc)

async def _process_message(redis_client: Redis, session_factory: async_sessionmaker, message_id: str, fields: dict):
    try:
        event_type = fields.get("event_type", "")
        project_id = fields.get("project_id")
        user_email = fields.get("user_email", "Someone")
        
        if project_id and event_type in ("task_created", "task_updated", "task_moved", "task_deleted"):
            metadata = json.loads(fields.get("metadata", "{}"))
            task_title = metadata.get("title", "A task")
            
            subject = f"Task Update in FlowForge: {task_title}"
            if event_type == "task_created":
                message = f"{user_email} created a new task: '{task_title}'."
            elif event_type == "task_deleted":
                message = f"{user_email} deleted task: '{task_title}'."
            elif event_type == "task_moved":
                new_status = metadata.get("new_status", "")
                message = f"{user_email} moved task '{task_title}' to {new_status}."
            else:
                message = f"{user_email} updated task: '{task_title}'."
            
            await _notify_members(session_factory, project_id, subject, message)
            
        await redis_client.xack("audit_log", "project_notifications", message_id)
    except Exception:
        logger.exception("Failed processing stream message %s", message_id)

async def consume_stream(redis_client: Redis, session_factory: async_sessionmaker):
    try:
        await redis_client.xgroup_create(name="audit_log", groupname="project_notifications", id="0", mkstream=True)
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            logger.exception("Failed creating consumer group: %s", exc)

    while True:
        try:
            messages = await redis_client.xreadgroup(
                groupname="project_notifications",
                consumername="project_worker_1",
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
        except Exception:
            logger.exception("Stream consumer loop error")
            await asyncio.sleep(5)
