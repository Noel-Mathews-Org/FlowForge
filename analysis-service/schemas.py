from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class OverviewResponse(BaseModel):
    total_tasks: int
    tasks_by_status: dict[str, int]
    total_projects: int
    total_users: int
    events_today: int
    completion_rate: float


class ThroughputPoint(BaseModel):
    date: date
    tasks_created: int
    tasks_completed: int
    tasks_in_progress: int


class UserActivityRow(BaseModel):
    user_id: str
    user_email: str
    events_count: int
    tasks_created: int
    tasks_completed: int


class AuditEventResponse(BaseModel):
    id: UUID
    event_type: str
    user_id: str
    user_email: str
    project_id: str | None
    task_id: str | None
    metadata: dict
    occurred_at: datetime
    ingested_at: datetime

    model_config = {"from_attributes": True}


class ProjectStatsRow(BaseModel):
    date: date
    project_id: str
    tasks_created: int
    tasks_completed: int
    tasks_in_progress: int
