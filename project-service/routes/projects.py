"""
Project service routes. Role names match FAD:
  platform_admin, org_owner, manager, member
"""
import os
import uuid
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import Project, ProjectMember
from rbac import get_current_user_id, require_role
from schemas import (
    MemberResponse,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)
from services.redis_service import append_audit_log

router = APIRouter(prefix="/projects", tags=["projects"])

ADMIN_ROLES = {"platform_admin", "org_owner"}
MANAGER_ROLES = {"platform_admin", "manager"}
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "")


class AddMemberRequest(BaseModel):
    user_id: str


class ArchiveRequest(BaseModel):
    pass


class UnarchiveRequest(BaseModel):
    member_ids: list[str] = []


def _parse_uuid(raw: str) -> UUID:
    try:
        return UUID(raw)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid user context") from exc


def _require_email(request: Request) -> str:
    email = getattr(request.state, "user_email", None)
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing authenticated user context")
    return email


async def _project_response(db: AsyncSession, project: Project) -> ProjectResponse:
    count = await db.scalar(
        select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project.id)
    )
    return ProjectResponse(
        id=project.id, name=project.name, description=project.description,
        manager_id=project.manager_id, manager_email=project.manager_email,
        is_archived=project.is_archived, created_at=project.created_at, member_count=count or 0,
    )


async def _can_access_project(db: AsyncSession, project_id: UUID, user_id: UUID, role: str | None) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if role in ADMIN_ROLES or project.manager_id == user_id:
        return project
    membership = await db.scalar(
        select(ProjectMember.id).where(
            and_(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        )
    )
    if not membership:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    # Members cannot access archived projects
    if project.is_archived:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Project is archived")
    return project


async def _notify_user(user_id: str, notif_type: str, title: str, content: str, metadata: dict):
    """Fire-and-forget: create in-app notification via auth-service."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{AUTH_SERVICE_URL}/internal/notifications",
                json={"user_id": user_id, "type": notif_type, "title": title, "content": content, "metadata": metadata},
                headers={"X-Internal-Token": INTERNAL_TOKEN},
            )
    except Exception:
        pass


# ─── List / Create ───────────────────────────────────────────────────────────

@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    request: Request,
    archived: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    user_id = _parse_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)

    base = select(Project).where(Project.is_archived == archived)
    if role in ADMIN_ROLES:
        pass  # see all
    elif role == "manager":
        base = base.where(Project.manager_id == user_id)
    else:
        base = base.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            ProjectMember.user_id == user_id
        )

    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    result = await db.execute(base.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    projects = result.scalars().all()
    return ProjectListResponse(projects=[await _project_response(db, p) for p in projects], total=total or 0)


@router.post("/", response_model=ProjectResponse, dependencies=[require_role("manager", "platform_admin")])
async def create_project(payload: ProjectCreate, request: Request, db: AsyncSession = Depends(get_db)):
    manager_id_raw = get_current_user_id(request)
    manager_email = _require_email(request)
    manager_id = _parse_uuid(manager_id_raw)
    org_id = uuid.UUID(getattr(request.state, "org_id", settings.default_org_id))

    # Enforce project name uniqueness within org
    existing = await db.scalar(
        select(Project.id).where(Project.org_id == org_id, Project.name == payload.name)
    )
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A project with this name already exists in your organization.")

    project = Project(
        org_id=org_id, name=payload.name, description=payload.description,
        manager_id=manager_id, manager_email=manager_email,
    )
    db.add(project)
    await db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=manager_id, user_email=manager_email))
    await db.commit()
    await db.refresh(project)
    await append_audit_log("project_created", manager_id_raw, str(project.id), {"name": project.name})
    return await _project_response(db, project)


# ─── Get / Update ────────────────────────────────────────────────────────────

@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(project_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _parse_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    project = await _can_access_project(db, project_id, user_id, role)
    members = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id).order_by(ProjectMember.joined_at)
    )).scalars().all()
    base = await _project_response(db, project)
    return ProjectDetailResponse(
        **base.model_dump(),
        members=[MemberResponse.model_validate(m) for m in members],
        pending_approval_count=0,
    )


@router.patch("/{project_id}", response_model=ProjectResponse, dependencies=[require_role("manager", "platform_admin")])
async def update_project(project_id: UUID, payload: ProjectUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _parse_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if role not in ADMIN_ROLES and project.manager_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only project manager can update")
    if project.is_archived and role not in ADMIN_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot edit archived project")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(project, k, v)
    await db.commit()
    await db.refresh(project)
    return await _project_response(db, project)


# ─── Archive / Unarchive ─────────────────────────────────────────────────────

@router.patch("/{project_id}/archive", dependencies=[require_role("manager", "platform_admin")])
async def archive_project(project_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _parse_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if role not in ADMIN_ROLES and project.manager_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only project manager can archive")
    if project.is_archived:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Project already archived")

    project.is_archived = True
    project.archived_by = user_id
    project.archived_at = datetime.now(timezone.utc)
    await db.commit()

    # Notify all members
    members = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    )).scalars().all()
    for m in members:
        if str(m.user_id) != str(user_id):
            await _notify_user(
                str(m.user_id), "project_archived",
                f"Project Archived: {project.name}",
                f"The project '{project.name}' has been archived.",
                {"project_id": str(project_id)},
            )

    await append_audit_log("project_archived", str(user_id), str(project_id), {"name": project.name})
    return {"success": True}


@router.patch("/{project_id}/unarchive", dependencies=[require_role("manager", "platform_admin")])
async def unarchive_project(project_id: UUID, payload: UnarchiveRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _parse_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if role not in ADMIN_ROLES and project.manager_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only project manager can unarchive")
    if not project.is_archived:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Project is not archived")

    project.is_archived = False
    project.unarchived_at = datetime.now(timezone.utc)

    # Replace member list
    await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    )
    # Delete old members
    old_members = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    )).scalars().all()
    for m in old_members:
        await db.delete(m)
    await db.flush()

    # Add manager back + new member list
    manager_email = _require_email(request)
    db.add(ProjectMember(project_id=project_id, user_id=user_id, user_email=manager_email))
    for uid_str in payload.member_ids:
        try:
            uid = uuid.UUID(uid_str)
            # Look up email from auth-service
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{AUTH_SERVICE_URL}/internal/users/{uid_str}",
                    headers={"X-Internal-Token": INTERNAL_TOKEN},
                )
                if resp.status_code == 200:
                    email = resp.json().get("email", uid_str)
                else:
                    email = uid_str
            db.add(ProjectMember(project_id=project_id, user_id=uid, user_email=email))
        except Exception:
            continue

    await db.commit()
    await append_audit_log("project_unarchived", str(user_id), str(project_id), {"name": project.name})
    return {"success": True}


# ─── Members ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}/members", response_model=list[MemberResponse])
async def list_members(project_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _parse_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    await _can_access_project(db, project_id, user_id, role)
    members = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id).order_by(ProjectMember.joined_at)
    )).scalars().all()
    return [MemberResponse.model_validate(m) for m in members]


@router.post("/{project_id}/members", response_model=list[MemberResponse])
async def add_member(project_id: UUID, payload: AddMemberRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _parse_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if role not in ADMIN_ROLES and project.manager_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only project manager can add members")
    if project.is_archived:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot add members to archived project")

    target_id = uuid.UUID(payload.user_id)
    existing = await db.scalar(
        select(ProjectMember.id).where(
            and_(ProjectMember.project_id == project_id, ProjectMember.user_id == target_id)
        )
    )
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User already a member")

    # Fetch email from auth-service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{AUTH_SERVICE_URL}/internal/users/{payload.user_id}",
                headers={"X-Internal-Token": INTERNAL_TOKEN},
            )
            email = resp.json().get("email", payload.user_id) if resp.status_code == 200 else payload.user_id
    except Exception:
        email = payload.user_id

    db.add(ProjectMember(project_id=project_id, user_id=target_id, user_email=email))
    await db.commit()

    await _notify_user(
        payload.user_id, "added_to_project",
        f"Added to Project: {project.name}",
        f"You have been added to project '{project.name}'.",
        {"project_id": str(project_id)},
    )
    await append_audit_log("member_added", str(user_id), str(project_id), {"added_user_id": payload.user_id})

    members = (await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id).order_by(ProjectMember.joined_at)
    )).scalars().all()
    return [MemberResponse.model_validate(m) for m in members]


@router.delete("/{project_id}/members/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(project_id: UUID, target_user_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = _parse_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if role not in ADMIN_ROLES and project.manager_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only project manager can remove members")
    member = await db.scalar(
        select(ProjectMember).where(
            and_(ProjectMember.project_id == project_id, ProjectMember.user_id == target_user_id)
        )
    )
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    await db.delete(member)
    await db.commit()


# ─── Internal: member transfer cleanup ───────────────────────────────────────

@router.post("/internal/member-transferred")
async def member_transferred(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
):
    if x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid internal token")
    body = await request.json()
    member_id = body.get("member_id")
    old_manager_id = body.get("old_manager_id")
    if not member_id or not old_manager_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "member_id and old_manager_id required")

    # Find projects owned by old manager that this member belongs to
    old_mgr_projects = (await db.execute(
        select(Project.id).where(Project.manager_id == uuid.UUID(old_manager_id))
    )).scalars().all()

    removed = []
    for pid in old_mgr_projects:
        m = await db.scalar(
            select(ProjectMember).where(
                and_(ProjectMember.project_id == pid, ProjectMember.user_id == uuid.UUID(member_id))
            )
        )
        if m:
            await db.delete(m)
            removed.append(str(pid))

    await db.commit()
    return {"removed_projects": removed}
