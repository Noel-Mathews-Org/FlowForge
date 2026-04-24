from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from models import ApprovalStatus


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2)
    description: str | None = None

class AddMemberRequest(BaseModel):
    user_id: UUID
    user_email: str


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    description: str | None = None
    is_archived: bool | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    manager_id: UUID
    manager_email: str
    is_archived: bool
    created_at: datetime
    member_count: int


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int


class ApprovalRequestCreate(BaseModel):
    project_id: UUID
    message: str | None = None


class ApprovalRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    project_name: str | None = None
    requester_id: UUID
    requester_email: str
    status: ApprovalStatus
    message: str | None
    requested_at: datetime
    resolved_at: datetime | None
    resolved_by: UUID | None


class ApprovalAction(BaseModel):
    action: Literal["APPROVED", "REJECTED"]


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    user_email: str
    member_role: str
    joined_at: datetime


class ProjectDetailResponse(ProjectResponse):
    members: list[MemberResponse]
    pending_approval_count: int
