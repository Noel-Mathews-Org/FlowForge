import uuid

from sqlalchemy import JSON, Date, DateTime, Integer, String, UniqueConstraint, func
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
    metadata: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    occurred_at: Mapped = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class DailyTaskStats(Base):
    __tablename__ = "daily_task_stats"
    __table_args__ = (UniqueConstraint("date", "project_id", name="uq_daily_task_stats_date_project"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped = mapped_column(Date, nullable=False)
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
    date: Mapped = mapped_column(Date, nullable=False)
    events_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tasks_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    tasks_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
