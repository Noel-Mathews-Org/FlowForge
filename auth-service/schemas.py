from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    role: str
    user_id: str
    full_name: str


class InviteRequest(BaseModel):
    email: EmailStr
    role: Literal["manager", "member"]


class InviteResponse(BaseModel):
    invite_url: str
    token: str
    message: str

class InviteToProjectRequest(BaseModel):
    email: EmailStr
    full_name: str | None = None

class InviteToProjectResponse(BaseModel):
    user_id: UUID
    email: str
    message: str

class RegisterRequest(BaseModel):
    token: str
    full_name: str
    password: str = Field(min_length=8)


class RegisterResponse(BaseModel):
    message: str
    user_id: str


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    org: str
    created_at: datetime


class PublicKeyResponse(BaseModel):
    public_key: str
    algorithm: str = "RS256"


class UpdateMeRequest(BaseModel):
    full_name: str | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8)


class AdminUserUpdateRequest(BaseModel):
    role: Literal["admin", "manager", "member"] | None = None
    is_active: bool | None = None
