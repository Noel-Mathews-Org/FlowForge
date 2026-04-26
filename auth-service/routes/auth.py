import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import InviteRole, InviteToken, User, UserRole
from schemas import (
    InviteRequest,
    InviteResponse,
    InviteToProjectRequest,
    InviteToProjectResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UpdateMeRequest,
    UserProfile,
)
from services import email_service, jwt_service, redis_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_profile(user: User) -> UserProfile:
    return UserProfile(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        org=user.org,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    if not bcrypt.checkpw(payload.password.encode("utf-8"), user.hashed_password.encode("utf-8")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = jwt_service.sign_jwt(user)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        role=user.role.value,
        user_id=str(user.id),
        full_name=user.full_name,
    )


@router.post("/invite", response_model=InviteResponse)
async def invite_user(
    payload: InviteRequest,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_name: str | None = Header(default="FlowForge Team", alias="X-User-Name"),
):
    if x_user_role not in {"manager", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing X-User-ID header")

    try:
        created_by = uuid.UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-User-ID header") from exc

    token = secrets.token_urlsafe(24)
    expires_at = datetime.now(UTC) + timedelta(hours=72)
    invite = InviteToken(
        token=token,
        email=str(payload.email),
        role=InviteRole(payload.role),
        created_by=created_by,
        used=False,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()

    invite_url = f"{settings.frontend_url}/register?token={token}"

    await redis_service.publish_event(
        "email.invite",
        {
            "to_email": str(payload.email),
            "invite_url": invite_url,
            "inviter_name": x_user_name or "FlowForge Team",
        },
    )
    await email_service.send_invite_email(str(payload.email), invite_url, x_user_name or "FlowForge Team")

    return InviteResponse(
        invite_url=invite_url,
        token=token,
        message="Invite token created and email dispatched",
    )

@router.post("/invite-to-project", response_model=InviteToProjectResponse)
async def invite_to_project(
    payload: InviteToProjectRequest,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_user_name: str | None = Header(default="FlowForge Team", alias="X-User-Name"),
):
    if x_user_role not in {"manager", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    result = await db.execute(select(User).where(User.email == payload.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    temp_password = secrets.token_urlsafe(12)
    hashed = bcrypt.hashpw(temp_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    user = User(
        email=payload.email,
        hashed_password=hashed,
        full_name=payload.full_name or payload.email.split("@")[0],
        role=UserRole.MEMBER,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    login_url = f"{settings.frontend_url}/login"
    await email_service.send_project_invite_email(
        to_email=str(payload.email),
        inviter_name=x_user_name or "FlowForge Team",
        login_url=login_url,
        temp_password=temp_password,
        is_new_user=True,
    )

    return InviteToProjectResponse(
        user_id=user.id,
        email=user.email,
        message="User created and email dispatched",
    )

@router.post("/register", response_model=RegisterResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InviteToken).where(InviteToken.token == payload.token))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite token")
    if invite.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite token already used")
    if invite.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite token has expired")

    existing = await db.execute(select(User).where(User.email == invite.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists for this email")

    hashed = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(
        email=invite.email,
        hashed_password=hashed,
        full_name=payload.full_name,
        role=UserRole(invite.role.value),
    )
    db.add(user)
    invite.used = True
    await db.commit()
    await db.refresh(user)

    return RegisterResponse(message="Registration successful", user_id=str(user.id))

@router.get("/lookup", response_model=UserProfile)
async def lookup_user(
    email: str,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    if x_user_role not in {"manager", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_profile(user)

@router.get("/me", response_model=UserProfile)
async def me(
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing X-User-ID header")
    try:
        user_id = uuid.UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-User-ID header") from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return _to_profile(user)


@router.put("/me", response_model=UserProfile)
async def update_me(
    payload: UpdateMeRequest,
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing X-User-ID header")
    try:
        user_id = uuid.UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid X-User-ID header") from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.full_name:
        user.full_name = payload.full_name

    if payload.new_password is not None:
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_password is required when changing password",
            )
        if not bcrypt.checkpw(
            payload.current_password.encode("utf-8"), user.hashed_password.encode("utf-8")
        ):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
        user.hashed_password = bcrypt.hashpw(
            payload.new_password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    await db.commit()
    await db.refresh(user)
    return _to_profile(user)
