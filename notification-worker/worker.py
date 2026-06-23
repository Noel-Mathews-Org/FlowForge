"""
Notification Worker — consumes the audit_log Redis stream and sends emails
for events that require email notifications:

  task_created (assigned)  → email to assignee
  approval_resolved        → email to assignee (approved/rejected)
  member_added             → email to the member added to a project
  member_removed           → email to the removed member
  member_transferred       → email to member about new manager
  project_created          → email to org_owner / platform_admin
  user_revoked             → email to the revoked user
  user_activated           → email to the activated user
  report_generated         → email to org_owner who generated it

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

import os

try:
    from keyvault import apply_keyvault_secrets
    apply_keyvault_secrets()
except Exception:
    pass

# ─── Config ──────────────────────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
REDIS_PREFIX = os.getenv("REDIS_PREFIX", "")
CONSUMER_GROUP = os.getenv("STREAM_CONSUMER_GROUP", f"{REDIS_PREFIX}notification-group")
CONSUMER_NAME = os.getenv("STREAM_CONSUMER_NAME", "notification-worker-1")
STREAM_NAME = f"{REDIS_PREFIX}audit_log"

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USERNAME", "")
SMTP_PASS = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)
SMTP_NAME = os.getenv("SMTP_FROM_NAME", "FlowForge")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

EMAIL_ENABLED = bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


# ─── HTML Email Template ─────────────────────────────────────────────────────

def _html_template(title: str, body_html: str, preview: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>FlowForge</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<span style="display:none!important;visibility:hidden;font-size:1px;line-height:1px;max-height:0;opacity:0;overflow:hidden;">{preview}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 0;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td align="center" style="padding:24px 0;">
      <span style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:12px;padding:10px 24px;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">&#9670; FlowForge</span>
    </td></tr>
  </table>
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <tr><td style="padding:40px 48px;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">{title}</h1>
      {body_html}
    </td></tr>
  </table>
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
    <tr><td align="center" style="padding:24px 48px;color:#8993a4;font-size:12px;line-height:18px;">
      <p style="margin:0;">This email was sent by <strong>FlowForge</strong>. If you did not expect this, you can safely ignore it.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>"""


# ─── SMTP ─────────────────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, html_body: str, text_body: str = "") -> None:
    if not EMAIL_ENABLED:
        logger.debug("SMTP not configured — skipping email to %s", to)
        return
    if not text_body:
        text_body = "Please view this message in an HTML-capable email client."
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_NAME} <{SMTP_FROM}>"
    msg["To"] = to
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))
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
    """Notify a member when they are assigned a task."""
    assignee_email = metadata.get("assignee_email") or fields.get("user_email", "")
    if not assignee_email:
        return
    task_title = metadata.get("title", "a task")
    priority = metadata.get("priority", "MEDIUM")
    subject = f"[FlowForge] New Task Assigned: {task_title}"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">A new task has been assigned to you</p>
    <div style="background:#f8f9fb;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;color:#3d4f5f;"><strong>Task:</strong> {task_title}</p>
      <p style="margin:0;font-size:14px;color:#3d4f5f;"><strong>Priority:</strong> {priority}</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 16px;">
      <a href="{FRONTEND_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">View My Tasks</a>
    </td></tr></table>"""
    html = _html_template("New Task Assigned", body_html, f"New task: {task_title}")
    text = f"A new task '{task_title}' (Priority: {priority}) has been assigned to you. View at {FRONTEND_URL}/dashboard"
    _send_email(assignee_email, subject, html, text)


def _handle_approval_resolved(fields: dict, metadata: dict) -> None:
    """Notify a member when their task approval is resolved."""
    assignee_email = metadata.get("assignee_email") or ""
    if not assignee_email:
        return
    action = metadata.get("action", "reviewed")
    approved = action == "approved"
    status_word = "Approved ✅" if approved else "Rejected ❌"
    status_color = "#10b981" if approved else "#ef4444"
    subject = f"[FlowForge] Task {status_word}"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">Your task has been reviewed</p>
    <div style="background:#f8f9fb;border-radius:8px;padding:24px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:{status_color};">Task {status_word}</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 16px;">
      <a href="{FRONTEND_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">View My Tasks</a>
    </td></tr></table>"""
    html = _html_template(f"Task {status_word}", body_html, f"Your task has been {action}")
    text = f"Your task completion request has been {action}. View at {FRONTEND_URL}/dashboard"
    _send_email(assignee_email, subject, html, text)


def _handle_member_added(fields: dict, metadata: dict) -> None:
    """Notify a user when they are added to a project."""
    email = metadata.get("user_email") or ""
    project_name = metadata.get("project_name", "a project")
    if not email:
        return
    subject = f"[FlowForge] Added to Project: {project_name}"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">You've been added to a new project</p>
    <div style="background:#f0fdf4;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0;font-size:15px;color:#166534;"><strong>Project:</strong> {project_name}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#3d4f5f;">You can now access the project board and view assigned tasks.</p>"""
    html = _html_template("Added to Project", body_html, f"You've been added to {project_name}")
    _send_email(email, subject, html)


def _handle_member_removed(fields: dict, metadata: dict) -> None:
    """Notify a user when removed from a project."""
    email = metadata.get("user_email") or ""
    project_name = metadata.get("project_name", "a project")
    if not email:
        return
    subject = f"[FlowForge] Removed from Project: {project_name}"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">You have been removed from a project</p>
    <div style="background:#fef2f2;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0;font-size:15px;color:#991b1b;"><strong>Project:</strong> {project_name}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#3d4f5f;">Contact your manager if you believe this was a mistake.</p>"""
    html = _html_template("Removed from Project", body_html, f"Removed from {project_name}")
    _send_email(email, subject, html)


def _handle_member_transferred(fields: dict, metadata: dict) -> None:
    """Notify a member when transferred to a new manager."""
    email = metadata.get("user_email") or ""
    new_manager = metadata.get("new_manager_name", "a new manager")
    if not email:
        return
    subject = "[FlowForge] Manager Reassignment"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">Your reporting manager has been updated</p>
    <div style="background:#eff6ff;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0;font-size:15px;color:#1e40af;"><strong>New Manager:</strong> {new_manager}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#3d4f5f;">Your projects and tasks remain unchanged.</p>"""
    html = _html_template("Manager Reassignment", body_html, f"You now report to {new_manager}")
    _send_email(email, subject, html)


def _handle_user_revoked(fields: dict, metadata: dict) -> None:
    """Notify a user when their account is revoked."""
    email = metadata.get("user_email") or ""
    if not email:
        return
    subject = "[FlowForge] Account Access Revoked"
    body_html = """
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">Your account access has been updated</p>
    <div style="background:#fef2f2;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0;font-size:15px;color:#991b1b;">Your FlowForge account access has been revoked by an administrator.</p>
    </div>
    <p style="margin:0;font-size:14px;color:#3d4f5f;">If you believe this is an error, please contact your organization administrator.</p>"""
    html = _html_template("Account Revoked", body_html, "Your FlowForge access has been revoked")
    _send_email(email, subject, html)


def _handle_user_activated(fields: dict, metadata: dict) -> None:
    """Notify a user when their account is re-activated."""
    email = metadata.get("user_email") or ""
    if not email:
        return
    subject = "[FlowForge] Account Reactivated"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">Great news! Your account is active again</p>
    <div style="background:#f0fdf4;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0;font-size:15px;color:#166534;">Your FlowForge account has been reactivated. You can now sign in and access your projects.</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 16px;">
      <a href="{FRONTEND_URL}/login" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Sign In</a>
    </td></tr></table>"""
    html = _html_template("Account Reactivated", body_html, "Your FlowForge account is active again")
    _send_email(email, subject, html)


def _handle_user_created(fields: dict, metadata: dict) -> None:
    """Notify a user when their account is created (first Entra ID login)."""
    email = metadata.get("user_email") or ""
    full_name = metadata.get("full_name") or "there"
    if not email:
        return
    subject = "[FlowForge] Welcome to FlowForge!"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">Welcome aboard, {full_name}!</p>
    <div style="background:#f0fdf4;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0;font-size:15px;color:#166534;">Your FlowForge account has been successfully created via Microsoft Entra ID. You can now access your projects and tasks.</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 16px;">
      <a href="{FRONTEND_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Go to Dashboard</a>
    </td></tr></table>"""
    html = _html_template("Welcome to FlowForge!", body_html, "Welcome to FlowForge")
    _send_email(email, subject, html)


def _handle_approval_requested(fields: dict, metadata: dict) -> None:
    """Notify a manager when a member marks a task as DONE."""
    manager_email = metadata.get("manager_email") or ""
    if not manager_email:
        return
    task_title = metadata.get("title", "A task")
    subject = f"[FlowForge] Approval Needed: {task_title}"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">A task requires your review</p>
    <div style="background:#fffbeb;border-radius:8px;padding:20px 24px;margin-bottom:20px;border-left:4px solid #f59e0b;">
      <p style="margin:0;font-size:15px;color:#92400e;"><strong>Task:</strong> {task_title} has been marked as DONE and is awaiting your approval.</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 16px;">
      <a href="{FRONTEND_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Review Task</a>
    </td></tr></table>"""
    html = _html_template("Approval Needed", body_html, f"Task {task_title} needs review")
    text = f"Task '{task_title}' has been marked as DONE and requires your approval. View at {FRONTEND_URL}/dashboard"
    _send_email(manager_email, subject, html, text)


def _handle_project_created(fields: dict, metadata: dict) -> None:
    """Notify org owner / platform admin when a new project is created (optional)."""
    admin_email = metadata.get("admin_email") or ""
    project_name = metadata.get("project_name", "New Project")
    creator = metadata.get("creator_name", "A manager")
    if not admin_email:
        return
    subject = f"[FlowForge] New Project Created: {project_name}"
    body_html = f"""
    <p style="margin:0 0 16px;font-size:15px;color:#8993a4;">A new project has been created in your organization</p>
    <div style="background:#f8f9fb;border-radius:8px;padding:20px 24px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;color:#3d4f5f;"><strong>Project:</strong> {project_name}</p>
      <p style="margin:0;font-size:14px;color:#3d4f5f;"><strong>Created by:</strong> {creator}</p>
    </div>"""
    html = _html_template("New Project Created", body_html, f"New project: {project_name}")
    _send_email(admin_email, subject, html)


# ─── Stream Consumer ──────────────────────────────────────────────────────────

EVENT_HANDLERS = {
    "task_created": _handle_task_assigned,
    "task_assigned": _handle_task_assigned,
    "approval_requested": _handle_approval_requested,
    "approval_resolved": _handle_approval_resolved,
    "member_added": _handle_member_added,
    "member_removed": _handle_member_removed,
    "member_transferred": _handle_member_transferred,
    "user_created": _handle_user_created,
    "user_revoked": _handle_user_revoked,
    "user_activated": _handle_user_activated,
    "project_created": _handle_project_created,
}


async def _process(fields: dict) -> None:
    event_type = fields.get("event_type", "")
    try:
        metadata = json.loads(fields.get("metadata", "{}"))
    except Exception:
        metadata = {}

    handler = EVENT_HANDLERS.get(event_type)
    if handler:
        # For task_created, only handle if there's an assignee
        if event_type == "task_created" and not metadata.get("assignee_email"):
            return
        handler(fields, metadata)
    else:
        logger.debug("No handler for event_type=%s", event_type)


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
