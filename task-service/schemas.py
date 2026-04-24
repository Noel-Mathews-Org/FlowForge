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
    status: Literal["TODO", "IN_PROGRESS", "DONE"] | None = None
    priority: Literal["LOW", "MEDIUM", "HIGH"] | None = None
    assignee_id: UUID | None = None
    assignee_email: str | None = None
    position: int | None = None


class TaskResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: str | None
    status: Literal["TODO", "IN_PROGRESS", "DONE"]
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
    needs_approval: bool = False
    proposed_status: str | None = None
    proposed_by: UUID | None = None

    model_config = {"from_attributes": True}


class KanbanResponse(BaseModel):
    TODO: list[TaskResponse]
    IN_PROGRESS: list[TaskResponse]
    DONE: list[TaskResponse]
