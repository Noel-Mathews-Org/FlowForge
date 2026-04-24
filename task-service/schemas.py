from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field
from typing_extensions import Literal


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
    description: str | None = None
    priority: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"
    assignee_id: UUID | None = None
    assignee_email: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: Literal["PENDING_REVIEW", "TODO", "PENDING_PROGRESS", "IN_PROGRESS", "PENDING_DONE", "DONE"] | None = None
    priority: Literal["LOW", "MEDIUM", "HIGH"] | None = None
    assignee_id: UUID | None = None
    assignee_email: str | None = None
    position: int | None = None


class TaskPositionUpdate(BaseModel):
    position: int = Field(..., ge=0)
    status: Literal["PENDING_REVIEW", "TODO", "PENDING_PROGRESS", "IN_PROGRESS", "PENDING_DONE", "DONE"]


class TaskResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: str | None
    status: Literal["PENDING_REVIEW", "TODO", "PENDING_PROGRESS", "IN_PROGRESS", "PENDING_DONE", "DONE"]
    priority: Literal["LOW", "MEDIUM", "HIGH"]
    assignee_id: UUID | None
    assignee_email: str | None
    created_by: UUID
    created_by_email: str
    position: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    comments: list[CommentResponse] | None = None

    model_config = {"from_attributes": True}


class KanbanResponse(BaseModel):
    PENDING_REVIEW: list[TaskResponse]
    TODO: list[TaskResponse]
    PENDING_PROGRESS: list[TaskResponse]
    IN_PROGRESS: list[TaskResponse]
    PENDING_DONE: list[TaskResponse]
    DONE: list[TaskResponse]


class TaskAssignActivateRequest(BaseModel):
    assignee_id: UUID | None = None
    assignee_email: str | None = None


class TaskProposeMoveRequest(BaseModel):
    target_status: Literal["IN_PROGRESS", "DONE"]
