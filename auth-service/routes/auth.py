import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import Invitation, User
from schemas import (
    ChangePasswordRequest,
    ForceResetRequest,
    InviteAcceptRequest,
    InviteAcceptResponse,
    InviteRequest,
    InviteVerifyResponse,
    LoginRequest,
    LoginResponse,
    UpdateMeRequest,
    UserProfile,
)
from services import email_service, jwt_service

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_ROLES = {"platform_admin", "org_owner"}
INVITE_ALLOWED = {"platform_admin", "org_owner", "manager"}


def _to_profile(u: User) -> UserProfile:
    return UserProfile(
        id=str(u.id),
        org_id=str(u.org_id),
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        manager_id=str(u.manager_id) if u.manager_id else None,
        notification_email=u.notification_email,
        must_reset_password=u.must_reset_password,
        is_active=u.is_active,
        created_at=u.created_at,
    )


# ─── Login ───────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not bcrypt.checkpw(payload.password.encode(), user.hashed_password.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated")

    token = jwt_service.sign_jwt(user)
    return LoginResponse(
        access_token=token,
        role=user.role,
        user_id=str(user.id),
        full_name=user.full_name,
        must_reset_password=user.must_reset_password,
    )


# Simple in-memory rate limiter: 10 invites per user per hour
_invite_rl: dict[str, list[float]] = {}

# ─── Invite ──────────────────────────────────────────────────────────────────

@router.post("/invite")
async def invite_user(
    payload: InviteRequest,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_user_name: str | None = Header(default="FlowForge Team", alias="X-User-Name"),
):
    # Rate limit: max 10 invites per hour per inviter
    import time as _time
    now = _time.time()
    window = _invite_rl.setdefault(x_user_id or "anon", [])
    _invite_rl[x_user_id or "anon"] = [t for t in window if now - t < 3600]
    if len(_invite_rl[x_user_id or "anon"]) >= 10:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded: max 10 invitations per hour")
    _invite_rl[x_user_id or "anon"].append(now)
    if not x_user_role or x_user_role not in INVITE_ALLOWED:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")

    # Managers can only invite members
    if x_user_role == "manager" and payload.role != "member":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Managers can only invite members")

    # member invites require a manager_id
    if payload.role == "member" and not payload.manager_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "manager_id required when inviting a member")

    # Validate target manager exists and is active
    manager_uuid: uuid.UUID | None = None
    if payload.manager_id:
        try:
            manager_uuid = uuid.UUID(payload.manager_id)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid manager_id")
        mgr = await db.get(User, manager_uuid)
        if not mgr or not mgr.is_active or mgr.role != "manager":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Specified manager not found or inactive")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(days=7)
    invite = Invitation(
        email=str(payload.email),
        role=payload.role,
        manager_id=manager_uuid,
        token=token,
        expires_at=expires_at,
        status="PENDING",
        created_by=uuid.UUID(x_user_id),
    )
    db.add(invite)
    await db.commit()

    invite_url = f"{settings.frontend_url}/invite/accept?token={token}"
    await email_service.send_invite_email(str(payload.email), invite_url, x_user_name or "FlowForge Team", payload.role)
    return {"success": True, "message": "Invitation sent", "invite_url": invite_url}


@router.get("/invite/verify", response_model=InviteVerifyResponse)
async def verify_invite(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Invitation).where(Invitation.token == token))
    invite = result.scalar_one_or_none()
    if not invite or invite.status != "PENDING" or invite.expires_at < datetime.now(UTC):
        return InviteVerifyResponse(valid=False, email="", role="")
    return InviteVerifyResponse(
        valid=True,
        email=invite.email,
        role=invite.role,
        manager_id=str(invite.manager_id) if invite.manager_id else None,
    )


@router.post("/invite/accept", response_model=InviteAcceptResponse)
async def accept_invite(payload: InviteAcceptRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Invitation).where(Invitation.token == payload.token))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid token")
    if invite.status != "PENDING":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invitation already used or cancelled")
    if invite.expires_at < datetime.now(UTC):
        invite.status = "EXPIRED"
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invitation has expired")

    existing = await db.execute(select(User).where(User.email == invite.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User already exists")

    hashed = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt(rounds=12)).decode()
    user = User(
        org_id=uuid.UUID(settings.default_org_id),
        email=invite.email,
        hashed_password=hashed,
        full_name=payload.full_name,
        role=invite.role,
        manager_id=invite.manager_id,
        is_active=True,
        must_reset_password=False,
    )
    db.add(user)
    invite.status = "ACCEPTED"
    await db.commit()
    token = jwt_service.sign_jwt(user)
    return InviteAcceptResponse(success=True, message="Registration successful. Please log in.", access_token=token)


# ─── Password ────────────────────────────────────────────────────────────────

@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    user = await db.get(User, uuid.UUID(x_user_id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if not bcrypt.checkpw(payload.old_password.encode(), user.hashed_password.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect")
    if bcrypt.checkpw(payload.new_password.encode(), user.hashed_password.encode()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be different from current password")
    user.hashed_password = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt(rounds=12)).decode()
    await db.commit()
    return {"success": True}


@router.post("/force-reset")
async def force_reset(
    payload: ForceResetRequest,
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_must_reset: str | None = Header(default=None, alias="X-Must-Reset"),
):
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    user = await db.get(User, uuid.UUID(x_user_id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if bcrypt.checkpw(payload.new_password.encode(), user.hashed_password.encode()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be different from the default password")
    user.hashed_password = bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt(rounds=12)).decode()
    user.must_reset_password = False
    await db.commit()
    return {"success": True, "must_reset_password": False}


# ─── Me ──────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserProfile)
async def me(
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    user = await db.get(User, uuid.UUID(x_user_id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _to_profile(user)


@router.put("/me", response_model=UserProfile)
async def update_me(
    payload: UpdateMeRequest,
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    user = await db.get(User, uuid.UUID(x_user_id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.notification_email is not None:
        user.notification_email = payload.notification_email
    await db.commit()
    await db.refresh(user)
    return _to_profile(user)



# ─── Refresh Token ────────────────────────────────────────────────────────────

class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    from models import RefreshToken  # avoid top-level circular if models loaded after
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == payload.refresh_token,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    rt = result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if rt.expires_at < datetime.now(UTC):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token expired")

    user = await db.get(User, rt.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    access_token = jwt_service.sign_jwt(user)
    return RefreshResponse(access_token=access_token)


@router.post("/logout")
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    from models import RefreshToken
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == payload.refresh_token)
    )
    rt = result.scalar_one_or_none()
    if rt:
        rt.revoked = True
        await db.commit()
    return {"success": True}


@router.post("/token/issue")
async def issue_refresh_token(
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    """Called after login to issue a refresh token. Returns refresh token string."""
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    from models import RefreshToken
    user = await db.get(User, uuid.UUID(x_user_id))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    token_str = secrets.token_urlsafe(48)
    rt = RefreshToken(
        user_id=user.id,
        token=token_str,
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
    )
    db.add(rt)
    await db.commit()
    return {"refresh_token": token_str, "expires_in_days": settings.refresh_token_days}

