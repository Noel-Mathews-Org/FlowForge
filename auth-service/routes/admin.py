import secrets
import uuid

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import User, UserRole
from schemas import AdminUserCreateRequest, AdminUserUpdateRequest, UserProfile
from services.email_service import send_notification_email

router = APIRouter(prefix="/auth/admin", tags=["admin"])


def _require_admin(x_user_role: str | None) -> None:
    if x_user_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")


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


@router.get("/users", response_model=list[UserProfile])
async def list_users(
    role: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_admin(x_user_role)

    stmt = select(User).order_by(User.created_at.desc())
    if role:
        try:
            stmt = stmt.where(User.role == UserRole(role))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role filter") from exc

    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)
    result = await db.execute(stmt)
    users = result.scalars().all()
    return [_to_profile(user) for user in users]


@router.post("/users", response_model=UserProfile)
async def create_user(
    payload: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_admin(x_user_role)

    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    temp_password = secrets.token_urlsafe(12)
    hashed = bcrypt.hashpw(temp_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    user = User(
        email=payload.email,
        hashed_password=hashed,
        full_name=payload.full_name,
        role=UserRole(payload.role),
        org=payload.org,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    login_url = f"{settings.frontend_url}/login"
    subject = "Your FlowForge Account"
    html_body = f"""
    <html>
      <body>
        <h2>Welcome to FlowForge</h2>
        <p>An administrator has created an account for you.</p>
        <p><strong>Username:</strong> {payload.email}</p>
        <p><strong>Temporary Password:</strong> {temp_password}</p>
        <p><a href="{login_url}" style="font-size:16px;font-weight:bold;">Log in to FlowForge</a></p>
        <p>Please log in and change your password immediately.</p>
      </body>
    </html>
    """
    text_body = f"Welcome to FlowForge. Your username is {payload.email} and temporary password is {temp_password}. Log in at {login_url}"
    await send_notification_email(str(payload.email), subject, html_body)

    return _to_profile(user)


@router.patch("/users/{user_id}", response_model=UserProfile)
async def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require_admin(x_user_role)
    try:
        parsed_id = uuid.UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from exc

    result = await db.execute(select(User).where(User.id == parsed_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.role is not None:
        user.role = UserRole(payload.role)
    if payload.is_active is not None:
        user.is_active = payload.is_active

    await db.commit()
    await db.refresh(user)
    return _to_profile(user)


@router.delete("/users/{user_id}")
async def soft_delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    _require_admin(x_user_role)
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing X-User-ID header")

    try:
        target_id = uuid.UUID(user_id)
        actor_id = uuid.UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id") from exc

    if target_id == actor_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == target_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    await db.commit()
    return {"message": "User deactivated"}
