from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    full_name: str
    must_reset_password: bool = False


# ─── Invite ──────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    role: str  # "manager" | "member"
    manager_id: Optional[str] = None  # Required when role=member

class InviteVerifyResponse(BaseModel):
    valid: bool
    email: str
    role: str
    manager_id: Optional[str] = None

class InviteAcceptRequest(BaseModel):
    token: str
    full_name: str
    password: str = Field(min_length=8)

class InviteAcceptResponse(BaseModel):
    success: bool
    message: str


# ─── Password ────────────────────────────────────────────────────────────────

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)

class ForceResetRequest(BaseModel):
    new_password: str = Field(min_length=8)


# ─── User Profile ────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    id: str
    org_id: str
    email: str
    full_name: str
    role: str
    manager_id: Optional[str] = None
    notification_email: Optional[str] = None
    must_reset_password: bool = False
    is_active: bool = True
    created_at: datetime

class UpdateMeRequest(BaseModel):
    full_name: Optional[str] = None
    notification_email: Optional[str] = None


# ─── User Management ─────────────────────────────────────────────────────────

class TransferMemberRequest(BaseModel):
    new_manager_id: str

class TransferMemberResponse(BaseModel):
    success: bool
    message: str
    removed_projects: list[str] = []


# ─── Notifications ───────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    content: str
    metadata: Optional[dict] = None
    is_read: bool
    created_at: datetime


# ─── Internal ────────────────────────────────────────────────────────────────

class InternalUserResponse(BaseModel):
    id: str
    org_id: str
    email: str
    full_name: str
    role: str
    manager_id: Optional[str] = None
    is_active: bool

class CreateNotificationRequest(BaseModel):
    user_id: str
    type: str
    title: str
    content: str
    metadata: Optional[dict] = None
