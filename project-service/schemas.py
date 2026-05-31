from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2)
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2)
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: Optional[str]
    manager_id: UUID
    manager_email: str
    is_archived: bool
    created_at: datetime
    member_count: int


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int


class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: UUID
    user_email: str
    joined_at: datetime


class ProjectDetailResponse(ProjectResponse):
    members: list[MemberResponse]
    pending_approval_count: int
