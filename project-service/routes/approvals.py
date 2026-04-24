from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ApprovalRequest, ApprovalStatus, Project, ProjectMember
from rbac import get_current_user_id, require_role
from schemas import ApprovalAction, ApprovalRequestResponse
from services.redis_service import append_audit_log, publish_user_notification

router = APIRouter(prefix="/projects", tags=["approvals"])


def _parse_uuid(raw: str) -> UUID:
    try:
        return UUID(raw)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid user context") from exc


@router.get("/approvals", response_model=list[ApprovalRequestResponse])
async def list_approvals(
    request: Request,
    status_filter: str = Query(default="PENDING", alias="status"),
    project_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(request.state, "user_role", "")
    if role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        approval_status = ApprovalStatus(status_filter.upper())
    except ValueError:
        approval_status = ApprovalStatus.PENDING

    user_id_raw = get_current_user_id(request)
    current_user_id = _parse_uuid(user_id_raw)

    query = select(ApprovalRequest, Project.name.label("project_name")).join(Project, ApprovalRequest.project_id == Project.id).where(ApprovalRequest.status == approval_status)
    if project_id:
        query = query.where(ApprovalRequest.project_id == project_id)
    if role == "manager":
        query = query.where(Project.manager_id == current_user_id)

    rows = (await db.execute(query.order_by(ApprovalRequest.requested_at.desc()))).all()
    
    result = []
    for row in rows:
        app_req = row.ApprovalRequest
        data = ApprovalRequestResponse.model_validate(app_req).model_dump()
        data["project_name"] = row.project_name
        result.append(ApprovalRequestResponse(**data))
    return result


@router.patch("/approvals/{request_id}", response_model=ApprovalRequestResponse)
async def resolve_approval(
    request_id: UUID,
    payload: ApprovalAction,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    role = getattr(request.state, "user_role", "")
    if role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    actor_id = _parse_uuid(get_current_user_id(request))
    approval = await db.get(ApprovalRequest, request_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Not found")
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=400, detail="Already resolved")

    project = await db.get(Project, approval.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if role != "admin" and project.manager_id != actor_id:
        raise HTTPException(status_code=403, detail="Not your project")

    new_status = ApprovalStatus(payload.action)
    approval.status = new_status
    approval.resolved_at = datetime.now(timezone.utc)
    approval.resolved_by = actor_id

    if new_status == ApprovalStatus.APPROVED:
        db.add(ProjectMember(
            project_id=approval.project_id,
            user_id=approval.requester_id,
            user_email=approval.requester_email,
            member_role="member",
        ))

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Already a member") from exc

    await db.refresh(approval)
    await publish_user_notification(str(approval.requester_id), {
        "type": "approval_result",
        "project_id": str(project.id),
        "project_name": project.name,
        "approved": new_status == ApprovalStatus.APPROVED,
    })
    return ApprovalRequestResponse.model_validate(approval)


@router.get("/my-requests", response_model=list[ApprovalRequestResponse])
async def my_requests(request: Request, db: AsyncSession = Depends(get_db)):
    uid = _parse_uuid(get_current_user_id(request))
    query = (
        select(ApprovalRequest, Project.name.label("project_name"))
        .join(Project, ApprovalRequest.project_id == Project.id)
        .where(ApprovalRequest.requester_id == uid)
        .order_by(ApprovalRequest.requested_at.desc())
    )
    rows = (await db.execute(query)).all()
    
    result = []
    for row in rows:
        app_req = row.ApprovalRequest
        data = ApprovalRequestResponse.model_validate(app_req).model_dump()
        data["project_name"] = row.project_name
        result.append(ApprovalRequestResponse(**data))
    return result