"""
Analytics endpoints — role-scoped per FAD Section 6.

  GET /analytics/platform/overview   → platform_admin
  GET /analytics/org/overview        → org_owner, platform_admin
  GET /analytics/manager/dashboard   → manager, platform_admin
  GET /analytics/member/dashboard    → member, org_owner, platform_admin
  GET /analytics/project/{id}/stats  → any authenticated user
  GET /analytics/events              → platform_admin
  GET /analytics/audit-log           → platform_admin (alias)
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import and_, desc, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditEvent, DailyTaskStats, UserActivityStats
from rbac import require_role
from schemas import AuditEventResponse, OverviewResponse, ProjectStatsRow, ThroughputPoint, UserActivityRow

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _require(role: str | None, allowed: set) -> None:
    if not role or role not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")


def _get_role(request: Request) -> str:
    return (getattr(request.state, "user_role", "") or "").lower()


# ─── Platform Admin Dashboard ─────────────────────────────────────────────────

@router.get("/platform/overview")
async def platform_overview(request: Request, db: AsyncSession = Depends(get_db)):
    _require(_get_role(request), {"platform_admin"})

    totals = await db.execute(
        select(
            func.coalesce(func.sum(DailyTaskStats.tasks_created), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_completed), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_in_progress), 0),
        )
    )
    created, completed, in_progress = totals.one()
    total_projects = (await db.execute(
        select(func.count(distinct(AuditEvent.project_id))).where(AuditEvent.project_id.is_not(None))
    )).scalar_one()
    total_users = (await db.execute(
        select(func.count(distinct(AuditEvent.user_id)))
    )).scalar_one()
    today = date.today()
    events_today = (await db.execute(
        select(func.count(AuditEvent.id)).where(func.date(AuditEvent.occurred_at) == today)
    )).scalar_one()

    recent_events = (await db.execute(
        select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(10)
    )).scalars().all()

    return {
        "total_tasks": int(created),
        "tasks_by_status": {
            "TODO": max(int(created - completed - in_progress), 0),
            "IN_PROGRESS": int(in_progress),
            "DONE": int(completed),
        },
        "total_projects": int(total_projects),
        "total_users": int(total_users),
        "events_today": int(events_today),
        "completion_rate": round(float(completed) / float(created) * 100, 2) if created else 0.0,
        "recent_audit_events": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "user_email": e.user_email,
                "occurred_at": e.occurred_at.isoformat(),
            }
            for e in recent_events
        ],
    }


# ─── Org Owner Dashboard ──────────────────────────────────────────────────────

@router.get("/org/overview")
async def org_overview(request: Request, db: AsyncSession = Depends(get_db)):
    _require(_get_role(request), {"org_owner", "platform_admin"})

    # Task aggregates across all projects
    totals = await db.execute(
        select(
            func.coalesce(func.sum(DailyTaskStats.tasks_created), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_completed), 0),
        )
    )
    created, completed = totals.one()

    # Per-project task throughput (last 30 days)
    start = date.today() - timedelta(days=29)
    proj_rows = (await db.execute(
        select(
            DailyTaskStats.project_id,
            func.sum(DailyTaskStats.tasks_completed).label("completed"),
            func.sum(DailyTaskStats.tasks_created).label("created"),
        )
        .where(DailyTaskStats.date >= start)
        .group_by(DailyTaskStats.project_id)
        .order_by(desc("completed"))
    )).all()

    return {
        "total_tasks": int(created),
        "total_completed": int(completed),
        "overall_completion_rate": round(float(completed) / float(created) * 100, 2) if created else 0.0,
        "project_throughput": [
            {"project_id": r.project_id, "tasks_completed": int(r.completed), "tasks_created": int(r.created)}
            for r in proj_rows
        ],
    }


# ─── Manager Dashboard ────────────────────────────────────────────────────────

@router.get("/manager/dashboard")
async def manager_dashboard(
    request: Request,
    db: AsyncSession = Depends(get_db),
    manager_id: str | None = Query(default=None),
):
    _require(_get_role(request), {"manager", "platform_admin"})

    # Team velocity: tasks completed per week for last 8 weeks
    start = date.today() - timedelta(weeks=8)
    stmt = (
        select(
            func.date_trunc("week", func.cast(DailyTaskStats.date, type_=None)).label("week"),
            func.sum(DailyTaskStats.tasks_completed).label("completed"),
        )
        .where(DailyTaskStats.date >= start)
        .group_by("week")
        .order_by("week")
    )
    if manager_id:
        # Filter by projects of this manager via project_id in audit events
        mgr_projects = (await db.execute(
            select(distinct(AuditEvent.project_id)).where(
                AuditEvent.user_id == manager_id,
                AuditEvent.event_type == "project_created",
            )
        )).scalars().all()
        if mgr_projects:
            stmt = stmt.where(DailyTaskStats.project_id.in_([p for p in mgr_projects if p]))

    velocity = (await db.execute(stmt)).all()

    return {
        "team_velocity_weekly": [
            {"week": str(r.week)[:10], "tasks_completed": int(r.completed or 0)}
            for r in velocity
        ],
    }


# ─── Member Dashboard ─────────────────────────────────────────────────────────

@router.get("/member/dashboard")
async def member_dashboard(request: Request, db: AsyncSession = Depends(get_db)):
    _require(_get_role(request), {"member", "org_owner", "manager", "platform_admin"})
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")

    start = date.today() - timedelta(weeks=5)
    stats = (await db.execute(
        select(
            func.coalesce(func.sum(UserActivityStats.tasks_created), 0),
            func.coalesce(func.sum(UserActivityStats.tasks_completed), 0),
        ).where(UserActivityStats.user_id == user_id, UserActivityStats.date >= start)
    )).one()

    weekly = (await db.execute(
        select(
            func.date_trunc("week", func.cast(UserActivityStats.date, type_=None)).label("week"),
            func.sum(UserActivityStats.tasks_completed).label("completed"),
        )
        .where(UserActivityStats.user_id == user_id, UserActivityStats.date >= start)
        .group_by("week")
        .order_by("week")
    )).all()

    return {
        "tasks_created": int(stats[0]),
        "tasks_completed": int(stats[1]),
        "completion_rate": round(float(stats[1]) / float(stats[0]) * 100, 2) if stats[0] else 0.0,
        "weekly_completion": [
            {"week": str(r.week)[:10], "completed": int(r.completed or 0)}
            for r in weekly
        ],
    }


# ─── Project Stats ────────────────────────────────────────────────────────────

@router.get("/project/{project_id}/stats", response_model=list[ProjectStatsRow])
async def project_stats(project_id: str, db: AsyncSession = Depends(get_db)):
    start = date.today() - timedelta(days=29)
    result = await db.execute(
        select(DailyTaskStats)
        .where(DailyTaskStats.project_id == project_id, DailyTaskStats.date >= start)
        .order_by(DailyTaskStats.date.asc())
    )
    return [
        ProjectStatsRow(
            date=r.date, project_id=r.project_id,
            tasks_created=r.tasks_created, tasks_completed=r.tasks_completed,
            tasks_in_progress=r.tasks_in_progress,
        )
        for r in result.scalars().all()
    ]


# ─── Audit Log ────────────────────────────────────────────────────────────────

@router.get("/events", response_model=list[AuditEventResponse], dependencies=[require_role("platform_admin")])
async def get_events(
    event_type: str | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditEvent)
    filters = []
    if event_type:
        filters.append(AuditEvent.event_type == event_type)
    if user_id:
        filters.append(AuditEvent.user_id == user_id)
    if project_id:
        filters.append(AuditEvent.project_id == project_id)
    if filters:
        stmt = stmt.where(and_(*filters))
    stmt = stmt.order_by(AuditEvent.occurred_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return [AuditEventResponse.model_validate(e) for e in result.scalars().all()]


@router.get("/audit-log", response_model=list[AuditEventResponse], dependencies=[require_role("platform_admin")])
async def audit_log(
    event_type: str | None = None,
    user_id: str | None = None,
    project_id: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await get_events(event_type=event_type, user_id=user_id, project_id=project_id,
                            page=page, page_size=page_size, db=db)



# ─── Manual Aggregation Trigger ───────────────────────────────────────────────

@router.post("/admin/aggregate", dependencies=[require_role("platform_admin")])
async def trigger_aggregation(db: AsyncSession = Depends(get_db)):
    """Manually run daily aggregation for yesterday. Idempotent."""
    from workers.aggregator import run_daily_aggregation
    result = await run_daily_aggregation()
    return {"success": True, "result": result}


# ─── Legacy overview (kept for backward compat) ───────────────────────────────

@router.get("/overview", dependencies=[require_role("platform_admin")])
async def legacy_overview(request: Request, db: AsyncSession = Depends(get_db)):
    return await platform_overview(request, db)
