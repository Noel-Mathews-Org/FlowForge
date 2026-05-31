"""
User management routes:
  GET  /users                        → org_owner, platform_admin
  GET  /users/team                   → manager (members under this manager)
  PATCH /users/{id}/revoke           → org_owner, platform_admin
  PATCH /users/{id}/activate         → org_owner, platform_admin
  PATCH /users/{id}/transfer         → org_owner (move member to new manager)
  GET  /users/{id}/history           → org_owner, platform_admin
  GET  /users/me/notifications       → all
  GET  /users/me/notifications/unread-count → all
  PATCH /users/me/notifications/{nid}/read  → all
  PATCH /users/me/notifications/read-all    → all
"""
import uuid

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import Notification, User
from schemas import NotificationResponse, TransferMemberRequest, TransferMemberResponse, UserProfile

router = APIRouter(prefix="/users", tags=["users"])

PROJECT_SERVICE_URL = "http://project-service:8002"


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


def _require(role: str, allowed: set[str]) -> None:
    if role not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")


# ─── User Lists ──────────────────────────────────────────────────────────────

@router.get("/", response_model=list[UserProfile])
async def list_users(
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
):
    _require(x_user_role or "", {"platform_admin", "org_owner"})
    stmt = select(User).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return [_to_profile(u) for u in result.scalars().all()]


@router.get("/team", response_model=list[UserProfile])
async def list_team(
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    _require(x_user_role or "", {"manager", "platform_admin", "org_owner"})
    if x_user_role == "manager":
        stmt = select(User).where(User.manager_id == uuid.UUID(x_user_id), User.is_active == True)
    else:
        stmt = select(User).where(User.role == "member")
    result = await db.execute(stmt)
    return [_to_profile(u) for u in result.scalars().all()]


# ─── Revoke / Activate ───────────────────────────────────────────────────────

@router.patch("/{user_id}/revoke")
async def revoke_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    _require(x_user_role or "", {"platform_admin", "org_owner"})
    target = await db.get(User, uuid.UUID(user_id))
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if str(target.id) == x_user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot revoke yourself")

    # Managers with members cannot be revoked
    if target.role == "manager":
        members = await db.execute(
            select(User).where(User.manager_id == target.id, User.is_active == True).limit(1)
        )
        if members.scalar_one_or_none():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Cannot revoke manager who still has active members. Transfer members first.",
            )

    target.is_active = False
    await db.commit()
    return {"success": True, "message": "User revoked"}


@router.patch("/{user_id}/activate")
async def activate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require(x_user_role or "", {"platform_admin", "org_owner"})
    target = await db.get(User, uuid.UUID(user_id))
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    target.is_active = True
    await db.commit()
    return {"success": True, "message": "User activated"}


# ─── Transfer ─────────────────────────────────────────────────────────────────

@router.patch("/{user_id}/transfer", response_model=TransferMemberResponse)
async def transfer_member(
    user_id: str,
    payload: TransferMemberRequest,
    db: AsyncSession = Depends(get_db),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require(x_user_role or "", {"org_owner", "platform_admin"})

    member = await db.get(User, uuid.UUID(user_id))
    if not member or member.role != "member":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")

    new_mgr = await db.get(User, uuid.UUID(payload.new_manager_id))
    if not new_mgr or not new_mgr.is_active or new_mgr.role != "manager":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "New manager not found or inactive")

    old_manager_id = str(member.manager_id) if member.manager_id else None
    member.manager_id = new_mgr.id
    await db.commit()

    # Ask project-service to clean up old project memberships
    removed_projects: list[str] = []
    if old_manager_id:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{PROJECT_SERVICE_URL}/internal/member-transferred",
                    json={"member_id": user_id, "old_manager_id": old_manager_id, "new_manager_id": payload.new_manager_id},
                    headers={"X-Internal-Token": settings.internal_api_key},
                )
                if resp.status_code == 200:
                    removed_projects = resp.json().get("removed_projects", [])
        except Exception:
            pass  # Graceful degradation — transfer already done in auth_db

    # Create in-app notification for the transferred member
    notif = Notification(
        user_id=member.id,
        type="member_transferred",
        title="You have been transferred",
        content=f"You have been transferred to manager {new_mgr.full_name}.",
        payload={"new_manager_id": str(new_mgr.id), "new_manager_email": new_mgr.email},
    )
    db.add(notif)
    await db.commit()

    return TransferMemberResponse(
        success=True,
        message=f"Member transferred to {new_mgr.email}",
        removed_projects=removed_projects,
    )


# ─── User History ─────────────────────────────────────────────────────────────

@router.get("/{user_id}/history")
async def user_history(
    user_id: str,
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
):
    _require(x_user_role or "", {"platform_admin", "org_owner"})
    # Proxy to analytics-service for audit trail
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "http://analysis-service:8004/analytics/events",
                params={"user_id": user_id},
                headers={"X-Internal-Token": settings.internal_api_key},
            )
            return resp.json()
    except Exception:
        return {"items": [], "total": 0}


# ─── Notifications ───────────────────────────────────────────────────────────

@router.get("/me/notifications", response_model=list[NotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    uid = uuid.UUID(x_user_id)
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == uid)
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return [
        NotificationResponse(
            id=str(n.id), type=n.type, title=n.title, content=n.content,
            metadata=n.payload, is_read=n.is_read, created_at=n.created_at
        )
        for n in result.scalars().all()
    ]


@router.get("/me/notifications/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    from sqlalchemy import func
    count = await db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == uuid.UUID(x_user_id), Notification.is_read == False
        )
    )
    return {"unread_count": count or 0}


@router.patch("/me/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    n = await db.get(Notification, uuid.UUID(notification_id))
    if not n or str(n.user_id) != x_user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    n.is_read = True
    await db.commit()
    return {"success": True}


@router.patch("/me/notifications/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
):
    if not x_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthenticated")
    await db.execute(
        update(Notification)
        .where(Notification.user_id == uuid.UUID(x_user_id), Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"success": True}
