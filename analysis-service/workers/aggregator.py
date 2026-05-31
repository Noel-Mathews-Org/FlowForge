"""
Daily aggregation job for FlowForge analytics.
Runs at midnight UTC: aggregates audit_events into daily_task_stats and user_activity_stats.

Can be triggered manually via POST /analytics/admin/aggregate (platform_admin only)
or runs automatically as a background asyncio task on startup.
"""
import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import AuditEvent, DailyTaskStats, UserActivityStats

logger = logging.getLogger("analytics.aggregator")


async def aggregate_day(session: AsyncSession, target_date: date) -> dict:
    """Aggregate audit events for a specific date into stats tables."""
    start = datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc)
    end   = start + timedelta(days=1)

    events = (await session.execute(
        select(AuditEvent).where(
            AuditEvent.occurred_at >= start,
            AuditEvent.occurred_at < end,
        )
    )).scalars().all()

    # ── daily_task_stats (by project) ─────────────────────────────────────────
    project_buckets: dict[str, dict] = {}
    for e in events:
        if not e.project_id:
            continue
        pid = e.project_id
        b   = project_buckets.setdefault(pid, {"created": 0, "completed": 0, "in_progress": 0})
        if e.event_type == "task_created":
            b["created"] += 1
        elif e.event_type in ("task_moved", "approval_resolved"):
            ns = (e.event_metadata or {}).get("new_status", "")
            if ns == "DONE":
                b["completed"] += 1
            elif ns == "IN_PROGRESS":
                b["in_progress"] += 1

    for pid, counts in project_buckets.items():
        existing = await session.scalar(
            select(DailyTaskStats).where(
                DailyTaskStats.date == target_date,
                DailyTaskStats.project_id == pid,
            )
        )
        if existing:
            existing.tasks_created     = counts["created"]
            existing.tasks_completed   = counts["completed"]
            existing.tasks_in_progress = counts["in_progress"]
        else:
            session.add(DailyTaskStats(
                date=target_date, project_id=pid,
                tasks_created=counts["created"],
                tasks_completed=counts["completed"],
                tasks_in_progress=counts["in_progress"],
            ))

    # ── user_activity_stats (by user) ─────────────────────────────────────────
    user_buckets: dict[str, dict] = {}
    for e in events:
        if not e.user_id:
            continue
        b = user_buckets.setdefault(e.user_id, {"email": e.user_email or "", "events": 0, "created": 0, "completed": 0})
        b["events"] += 1
        if e.event_type == "task_created":
            b["created"] += 1
        elif e.event_type in ("task_moved", "approval_resolved"):
            if (e.event_metadata or {}).get("new_status") == "DONE":
                b["completed"] += 1

    for uid, info in user_buckets.items():
        existing = await session.scalar(
            select(UserActivityStats).where(
                UserActivityStats.date == target_date,
                UserActivityStats.user_id == uid,
            )
        )
        if existing:
            existing.user_email     = info["email"]
            existing.events_count   = info["events"]
            existing.tasks_created  = info["created"]
            existing.tasks_completed = info["completed"]
        else:
            session.add(UserActivityStats(
                date=target_date, user_id=uid, user_email=info["email"],
                events_count=info["events"],
                tasks_created=info["created"],
                tasks_completed=info["completed"],
            ))

    await session.commit()
    return {"date": str(target_date), "projects": len(project_buckets), "users": len(user_buckets)}


async def run_daily_aggregation() -> None:
    """Aggregate yesterday's data (safe to run at any time after midnight)."""
    yesterday = date.today() - timedelta(days=1)
    async with AsyncSessionLocal() as session:
        result = await aggregate_day(session, yesterday)
        logger.info("Daily aggregation complete: %s", result)


async def aggregation_scheduler() -> None:
    """Background loop: sleeps until midnight UTC, then runs aggregation."""
    while True:
        now = datetime.now(timezone.utc)
        next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=30, microsecond=0)
        sleep_secs = (next_midnight - now).total_seconds()
        logger.info("Next aggregation in %.0f seconds (%s UTC)", sleep_secs, next_midnight.isoformat())
        await asyncio.sleep(sleep_secs)
        try:
            await run_daily_aggregation()
        except Exception as exc:
            logger.error("Aggregation failed: %s", exc)
