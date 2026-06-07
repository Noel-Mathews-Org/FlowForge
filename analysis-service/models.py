import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    user_email: Mapped[str] = mapped_column(String(320), nullable=False)
    project_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_metadata: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DailyTaskStats(Base):
    __tablename__ = "daily_task_stats"
    __table_args__ = (UniqueConstraint("date", "project_id", name="uq_daily_task_stats_date_project"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    project_id: Mapped[str] = mapped_column(String(64), nullable=False)
    tasks_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tasks_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tasks_in_progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class UserActivityStats(Base):
    __tablename__ = "user_activity_stats"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_user_activity_stats_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    user_email: Mapped[str] = mapped_column(String(320), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    events_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tasks_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tasks_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class AiUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    project_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())