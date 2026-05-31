"""Internal service-to-service endpoints. All require X-Internal-Token header."""
import uuid

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import Notification, User
from schemas import CreateNotificationRequest, InternalUserResponse

router = APIRouter(tags=["internal"])


def _check_internal_token(x_internal_token: str | None = Header(default=None, alias="X-Internal-Token")):
    if not x_internal_token or x_internal_token != settings.internal_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid internal token")


@router.get("/users/by-email", response_model=InternalUserResponse, dependencies=[Depends(_check_internal_token)])
async def get_user_by_email(email: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return InternalUserResponse(
        id=str(user.id), org_id=str(user.org_id), email=user.email,
        full_name=user.full_name, role=user.role,
        manager_id=str(user.manager_id) if user.manager_id else None,
        is_active=user.is_active,
    )


@router.get("/users/{user_id}/validate-manager", dependencies=[Depends(_check_internal_token)])
async def validate_manager(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, uuid.UUID(user_id))
    if not user or not user.is_active or user.role != "manager":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Manager not found or inactive")
    return {"valid": True, "user_id": str(user.id), "email": user.email}


@router.get("/users/{user_id}", response_model=InternalUserResponse, dependencies=[Depends(_check_internal_token)])
async def get_user_by_id(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return InternalUserResponse(
        id=str(user.id), org_id=str(user.org_id), email=user.email,
        full_name=user.full_name, role=user.role,
        manager_id=str(user.manager_id) if user.manager_id else None,
        is_active=user.is_active,
    )


@router.post("/notifications", dependencies=[Depends(_check_internal_token)])
async def create_notification(payload: CreateNotificationRequest, db: AsyncSession = Depends(get_db)):
    """Called by other services to create in-app notifications."""
    n = Notification(
        user_id=uuid.UUID(payload.user_id),
        type=payload.type,
        title=payload.title,
        content=payload.content,
        metadata=payload.metadata,
    )
    db.add(n)
    await db.commit()
    return {"success": True, "id": str(n.id)}
