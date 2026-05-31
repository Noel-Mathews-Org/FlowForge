"""
Notification Worker — consumes the audit_log Redis stream and sends emails
for events that require email notifications per FAD Section 8.2:

  task_assigned        → email to assignee
  approval_resolved    → email to assignee (approved/rejected)
  invite_sent          → email to invited user (handled directly by auth-service)

In-app notifications are already created by individual services via HTTP to
auth-service /internal/notifications. This worker handles SMTP emails only.
"""
import asyncio
import json
import logging
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from redis.asyncio import Redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [notification-worker] %(message)s",
)
logger = logging.getLogger("notification-worker")

# ─── Config ──────────────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
CONSUMER_GROUP = os.getenv("STREAM_CONSUMER_GROUP", "notification-group")
CONSUMER_NAME = os.getenv("STREAM_CONSUMER_NAME", "notification-worker-1")
STREAM_NAME = "audit_log"

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USERNAME", "")
SMTP_PASS = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)
SMTP_NAME = os.getenv("SMTP_FROM_NAME", "FlowForge")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

EMAIL_ENABLED = bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


# ─── SMTP ─────────────────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, body: str) -> None:
    if not EMAIL_ENABLED:
        logger.debug("SMTP not configured — skipping email to %s", to)
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_NAME} <{SMTP_FROM}>"
    msg["To"] = to
    msg.attach(MIMEText(body, "plain"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as srv:
            srv.starttls()
            srv.login(SMTP_USER, SMTP_PASS)
            srv.sendmail(SMTP_FROM, [to], msg.as_string())
        logger.info("Email sent to %s: %s", to, subject)
    except Exception as exc:
        logger.warning("Email send failed to %s: %s", to, exc)


# ─── Event Handlers ───────────────────────────────────────────────────────────

def _handle_task_assigned(fields: dict, metadata: dict) -> None:
    assignee_email = metadata.get("assignee_email") or fields.get("user_email", "")
    if not assignee_email:
        return
    task_title = metadata.get("title", "a task")
    assigner_email = fields.get("user_email", "someone")
    subject = f"[FlowForge] New Task Assigned: {task_title}"
    body = (
        f"Hello,\n\n"
        f"{assigner_email} assigned you a new task:\n\n"
        f"Task: {task_title}\n"
        f"Priority: {metadata.get('priority', 'MEDIUM')}\n\n"
        f"View your tasks: {FRONTEND_URL}/dashboard\n\n"
        f"---\nFlowForge Platform"
    )
    _send_email(assignee_email, subject, body)


def _handle_approval_resolved(fields: dict, metadata: dict) -> None:
    assignee_email = metadata.get("assignee_email") or ""
    if not assignee_email:
        return
    action = metadata.get("action", "reviewed")
    task_id = fields.get("task_id", "")
    approved = action == "approved"
    status_word = "APPROVED ✅" if approved else "REJECTED ❌"
    subject = f"[FlowForge] Task {status_word}"
    body = (
        f"Hello,\n\n"
        f"Your task completion request has been {action}.\n\n"
        f"View your tasks: {FRONTEND_URL}/dashboard\n\n"
        f"---\nFlowForge Platform"
    )
    _send_email(assignee_email, subject, body)


# ─── Stream Consumer ──────────────────────────────────────────────────────────

async def _process(fields: dict) -> None:
    event_type = fields.get("event_type", "")
    try:
        metadata = json.loads(fields.get("metadata", "{}"))
    except Exception:
        metadata = {}

    if event_type == "task_created" and metadata.get("assignee_email"):
        _handle_task_assigned(fields, metadata)
    elif event_type == "approval_resolved":
        _handle_approval_resolved(fields, metadata)


async def run() -> None:
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    # Wait for Redis to be ready
    for attempt in range(10):
        try:
            await redis.ping()
            break
        except Exception:
            logger.warning("Redis not ready, retry %d/10...", attempt + 1)
            await asyncio.sleep(3)

    try:
        await redis.xgroup_create(STREAM_NAME, CONSUMER_GROUP, id="0", mkstream=True)
        logger.info("Consumer group '%s' created", CONSUMER_GROUP)
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            logger.error("Failed to create consumer group: %s", exc)

    logger.info("Notification worker started (email=%s)", EMAIL_ENABLED)
    while True:
        try:
            messages = await redis.xreadgroup(
                groupname=CONSUMER_GROUP,
                consumername=CONSUMER_NAME,
                streams={STREAM_NAME: ">"},
                count=10,
                block=2000,
            )
            if not messages:
                continue
            for _, stream_msgs in messages:
                for msg_id, fields in stream_msgs:
                    try:
                        await _process(fields)
                    except Exception as exc:
                        logger.warning("Error processing message %s: %s", msg_id, exc)
                    finally:
                        await redis.xack(STREAM_NAME, CONSUMER_GROUP, msg_id)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Consumer loop error: %s", exc)
            await asyncio.sleep(5)

    await redis.aclose()
    logger.info("Notification worker stopped")


if __name__ == "__main__":
    asyncio.run(run())
