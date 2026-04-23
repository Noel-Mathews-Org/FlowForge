from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ApprovalRequest, ApprovalStatus, Project, ProjectMember
from rbac import get_current_user_id, require_role
from schemas import (
    ApprovalRequestCreate,
    ApprovalRequestResponse,
    MemberResponse,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)
from services.redis_service import append_audit_log, publish_manager_notification

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _parse_user_uuid(raw_id: str) -> UUID:
    try:
        return UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user context") from exc


def _require_email(request: Request) -> str:
    user_email = getattr(request.state, "user_email", None)
    if not user_email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authenticated user context")
    return user_email


async def _project_response(session: AsyncSession, project: Project) -> ProjectResponse:
    member_count = await session.scalar(
        select(func.count(ProjectMember.id)).where(ProjectMember.project_id == project.id)
    )
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        manager_id=project.manager_id,
        manager_email=project.manager_email,
        is_archived=project.is_archived,
        created_at=project.created_at,
        member_count=member_count or 0,
    )


async def _can_access_project(session: AsyncSession, project_id: UUID, user_id: UUID, role: str | None) -> Project:
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if role == "admin" or project.manager_id == user_id:
        return project

    membership = await session.scalar(
        select(ProjectMember.id).where(
            and_(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        )
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return project


@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    request: Request,
    archived: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    user_id = _parse_user_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)

    base_query = select(Project).where(Project.is_archived == archived)
    if role == "admin":
        pass
    elif role == "manager":
        base_query = base_query.where(Project.manager_id == user_id)
    else:
        base_query = (
            base_query.join(ProjectMember, ProjectMember.project_id == Project.id).where(ProjectMember.user_id == user_id)
        )

    total = await db.scalar(select(func.count()).select_from(base_query.subquery()))
    projects = (
        (
            await db.execute(
                base_query.order_by(Project.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )

    response_projects = [await _project_response(db, project) for project in projects]
    return ProjectListResponse(projects=response_projects, total=total or 0)


@router.post("/", response_model=ProjectResponse, dependencies=[require_role("manager", "admin")])
async def create_project(
    payload: ProjectCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    manager_id_raw = get_current_user_id(request)
    manager_email = _require_email(request)
    manager_id = _parse_user_uuid(manager_id_raw)

    project = Project(
        name=payload.name,
        description=payload.description,
        manager_id=manager_id,
        manager_email=manager_email,
    )
    db.add(project)
    await db.flush()

    manager_member = ProjectMember(
        project_id=project.id,
        user_id=manager_id,
        user_email=manager_email,
        member_role="manager",
    )
    db.add(manager_member)
    await db.commit()
    await db.refresh(project)

    await append_audit_log(
        event_type="project_created",
        user_id=manager_id_raw,
        project_id=str(project.id),
        metadata={"project_name": project.name},
    )
    return await _project_response(db, project)


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project_detail(
    project_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = _parse_user_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    project = await _can_access_project(db, project_id, user_id, role)

    members = (
        (
            await db.execute(select(ProjectMember).where(ProjectMember.project_id == project_id).order_by(ProjectMember.joined_at))
        )
        .scalars()
        .all()
    )
    pending_count = await db.scalar(
        select(func.count(ApprovalRequest.id)).where(
            and_(ApprovalRequest.project_id == project_id, ApprovalRequest.status == ApprovalStatus.PENDING)
        )
    )
    base = await _project_response(db, project)
    return ProjectDetailResponse(
        **base.model_dump(),
        members=[MemberResponse.model_validate(member) for member in members],
        pending_approval_count=pending_count or 0,
    )


@router.patch("/{project_id}", response_model=ProjectResponse, dependencies=[require_role("manager", "admin")])
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user_id = _parse_user_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)

    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if role != "admin" and project.manager_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project manager or admin can update")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(project, key, value)

    await db.commit()
    await db.refresh(project)
    return await _project_response(db, project)


@router.get("/{project_id}/members", response_model=list[MemberResponse])
async def list_project_members(
    project_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = _parse_user_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)
    await _can_access_project(db, project_id, user_id, role)

    members = (
        (
            await db.execute(select(ProjectMember).where(ProjectMember.project_id == project_id).order_by(ProjectMember.joined_at))
        )
        .scalars()
        .all()
    )
    return [MemberResponse.model_validate(member) for member in members]


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    project_id: UUID,
    user_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user_id = _parse_user_uuid(get_current_user_id(request))
    role = getattr(request.state, "user_role", None)

    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if role != "admin" and project.manager_id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project manager or admin can remove members")

    member = await db.scalar(
        select(ProjectMember).where(and_(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id))
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if user_id == current_user_id:
        manager_count = await db.scalar(
            select(func.count(ProjectMember.id)).where(
                and_(ProjectMember.project_id == project_id, ProjectMember.member_role == "manager")
            )
        )
        if (manager_count or 0) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove yourself as the last manager",
            )

    await db.delete(member)
    await db.commit()
    return None


@router.post("/request-access", response_model=ApprovalRequestResponse)
async def request_project_access(
    payload: ApprovalRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    requester_id_raw = get_current_user_id(request)
    requester_email = _require_email(request)
    requester_id = _parse_user_uuid(requester_id_raw)

    project = await db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    is_member = await db.scalar(
        select(ProjectMember.id).where(
            and_(ProjectMember.project_id == payload.project_id, ProjectMember.user_id == requester_id)
        )
    )
    if is_member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already a member")

    pending = await db.scalar(
        select(ApprovalRequest.id).where(
            and_(
                ApprovalRequest.project_id == payload.project_id,
                ApprovalRequest.requester_id == requester_id,
                ApprovalRequest.status == ApprovalStatus.PENDING,
            )
        )
    )
    if pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already pending")

    approval = ApprovalRequest(
        project_id=payload.project_id,
        requester_id=requester_id,
        requester_email=requester_email,
        message=payload.message,
    )
    db.add(approval)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already pending") from exc
    await db.refresh(approval)

    await publish_manager_notification(
        {
            "type": "access_request",
            "project_id": str(project.id),
            "project_name": project.name,
            "requester_id": requester_id_raw,
            "requester_email": requester_email,
            "request_id": str(approval.id),
        }
    )
    await append_audit_log(
        event_type="approval_requested",
        user_id=requester_id_raw,
        project_id=str(project.id),
        metadata={"request_id": str(approval.id), "message": payload.message},
    )

    return ApprovalRequestResponse.model_validate(approval)
