from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, desc, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AuditEvent, DailyTaskStats, UserActivityStats
from rbac import require_role
from schemas import AuditEventResponse, OverviewResponse, ProjectStatsRow, ThroughputPoint, UserActivityRow

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[require_role("admin")])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(db: AsyncSession = Depends(get_db)):
    totals = await db.execute(
        select(
            func.coalesce(func.sum(DailyTaskStats.tasks_created), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_completed), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_in_progress), 0),
        )
    )
    tasks_created, tasks_completed, tasks_in_progress = totals.one()
    total_projects = (await db.execute(select(func.count(distinct(AuditEvent.project_id))).where(AuditEvent.project_id.is_not(None)))).scalar_one()
    total_users = (await db.execute(select(func.count(distinct(AuditEvent.user_id))))).scalar_one()
    today = date.today()
    events_today = (await db.execute(select(func.count(AuditEvent.id)).where(func.date(AuditEvent.occurred_at) == today))).scalar_one()
    completion_rate = (float(tasks_completed) / float(tasks_created) * 100.0) if tasks_created else 0.0
    return OverviewResponse(
        total_tasks=int(tasks_created),
        tasks_by_status={"TODO": max(int(tasks_created - tasks_completed - tasks_in_progress), 0), "IN_PROGRESS": int(tasks_in_progress), "DONE": int(tasks_completed)},
        total_projects=int(total_projects),
        total_users=int(total_users),
        events_today=int(events_today),
        completion_rate=round(completion_rate, 2),
    )


@router.get("/task-throughput", response_model=list[ThroughputPoint])
async def get_task_throughput(days: int = Query(default=7, ge=1, le=30), db: AsyncSession = Depends(get_db)):
    start_date = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(
            DailyTaskStats.date,
            func.coalesce(func.sum(DailyTaskStats.tasks_created), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_completed), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_in_progress), 0),
        ).where(DailyTaskStats.date >= start_date).group_by(DailyTaskStats.date).order_by(DailyTaskStats.date.asc())
    )
    return [ThroughputPoint(date=r[0], tasks_created=int(r[1]), tasks_completed=int(r[2]), tasks_in_progress=int(r[3])) for r in result.all()]


@router.get("/user-activity", response_model=list[UserActivityRow])
async def get_user_activity(days: int = Query(default=7, ge=1, le=30), limit: int = Query(default=10, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    start_date = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(
            UserActivityStats.user_id,
            UserActivityStats.user_email,
            func.coalesce(func.sum(UserActivityStats.events_count), 0),
            func.coalesce(func.sum(UserActivityStats.tasks_created), 0),
            func.coalesce(func.sum(UserActivityStats.tasks_completed), 0),
        ).where(UserActivityStats.date >= start_date).group_by(UserActivityStats.user_id, UserActivityStats.user_email).order_by(desc(func.sum(UserActivityStats.events_count))).limit(limit)
    )
    return [UserActivityRow(user_id=r[0], user_email=r[1], events_count=int(r[2]), tasks_created=int(r[3]), tasks_completed=int(r[4])) for r in result.all()]


@router.get("/events", response_model=list[AuditEventResponse])
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


@router.get("/project/{project_id}/stats", response_model=list[ProjectStatsRow])
async def get_project_stats(project_id: str, db: AsyncSession = Depends(get_db)):
    start_date = date.today() - timedelta(days=29)
    result = await db.execute(
        select(DailyTaskStats).where(DailyTaskStats.project_id == project_id, DailyTaskStats.date >= start_date).order_by(DailyTaskStats.date.asc())
    )
    return [ProjectStatsRow(date=r.date, project_id=r.project_id, tasks_created=r.tasks_created, tasks_completed=r.tasks_completed, tasks_in_progress=r.tasks_in_progress) for r in result.scalars().all()]
