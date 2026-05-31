from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1)


class CommentResponse(BaseModel):
    id: UUID
    task_id: UUID
    author_id: UUID
    author_email: str
    body: str
    created_at: datetime
    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    project_id: UUID
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"  # LOW | MEDIUM | HIGH
    assignee_id: Optional[UUID] = None
    assignee_email: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # TODO | IN_PROGRESS | DONE | BLOCKED
    priority: Optional[str] = None
    assignee_id: Optional[UUID] = None
    assignee_email: Optional[str] = None
    position: Optional[int] = None


class ApprovalRejectRequest(BaseModel):
    comment: Optional[str] = None


class TaskResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: Optional[str]
    status: str
    priority: str
    assignee_id: Optional[UUID]
    assignee_email: Optional[str]
    created_by: UUID
    created_by_email: str
    position: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]
    comments: Optional[list[CommentResponse]] = None
    needs_approval: bool = False
    proposed_status: Optional[str] = None
    proposed_by: Optional[UUID] = None
    model_config = {"from_attributes": True}


class KanbanResponse(BaseModel):
    TODO: list[TaskResponse] = []
    IN_PROGRESS: list[TaskResponse] = []
    DONE: list[TaskResponse] = []
    BLOCKED: list[TaskResponse] = []
