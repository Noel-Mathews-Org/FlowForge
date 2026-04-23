from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ApprovalRequest, ApprovalStatus, Project, ProjectMember
from rbac import get_current_user_id, require_role
from schemas import ApprovalAction, ApprovalRequestResponse
from services.redis_service import append_audit_log, publish_user_notification

router = APIRouter(prefix="/projects", tags=["approvals"])


def _parse_user_uuid(raw_id: str) -> UUID:
    try:
        return UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user context") from exc


@router.get("/approvals", response_model=list[ApprovalRequestResponse], dependencies=[require_role("manager", "admin")])
async def list_approvals(
    request: Request,
    status_filter: ApprovalStatus = Query(default=ApprovalStatus.PENDING, alias="status"),
    project_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    role = getattr(request.state, "user_role", None)
    current_user_id = _parse_user_uuid(get_current_user_id(request))

    query = select(ApprovalRequest).where(ApprovalRequest.status == status_filter)
    if project_id:
        query = query.where(ApprovalRequest.project_id == project_id)
    if role == "manager":
        query = query.join(Project, ApprovalRequest.project_id == Project.id).where(Project.manager_id == current_user_id)

    approvals = (await db.execute(query.order_by(ApprovalRequest.requested_at.desc()))).scalars().all()
    return [ApprovalRequestResponse.model_validate(row) for row in approvals]


@router.patch(
    "/approvals/{request_id}",
    response_model=ApprovalRequestResponse,
    dependencies=[require_role("manager", "admin")],
)
async def resolve_approval(
    request_id: UUID,
    payload: ApprovalAction,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    role = getattr(request.state, "user_role", None)
    actor_id_raw = get_current_user_id(request)
    actor_id = _parse_user_uuid(actor_id_raw)

    approval = await db.get(ApprovalRequest, request_id)
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found")
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Approval request is already resolved")

    project = await db.get(Project, approval.project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if role != "admin" and project.manager_id != actor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project manager or admin can resolve")

    new_status = ApprovalStatus(payload.action)
    approval.status = new_status
    approval.resolved_at = datetime.now(timezone.utc)
    approval.resolved_by = actor_id

    if new_status == ApprovalStatus.APPROVED:
        db.add(
            ProjectMember(
                project_id=approval.project_id,
                user_id=approval.requester_id,
                user_email=approval.requester_email,
                member_role="member",
            )
        )

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a member") from exc
    await db.refresh(approval)

    await publish_user_notification(
        requester_id=str(approval.requester_id),
        payload={
            "type": "approval_result",
            "project_id": str(project.id),
            "project_name": project.name,
            "approved": new_status == ApprovalStatus.APPROVED,
            "resolved_by": actor_id_raw,
        },
    )
    await append_audit_log(
        event_type="approval_resolved",
        user_id=actor_id_raw,
        project_id=str(project.id),
        metadata={"request_id": str(approval.id), "status": new_status.value},
    )

    return ApprovalRequestResponse.model_validate(approval)


@router.get("/my-requests", response_model=list[ApprovalRequestResponse])
async def my_approval_requests(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    current_user_id = _parse_user_uuid(get_current_user_id(request))
    rows = (
        (
            await db.execute(
                select(ApprovalRequest)
                .where(ApprovalRequest.requester_id == current_user_id)
                .order_by(ApprovalRequest.requested_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [ApprovalRequestResponse.model_validate(row) for row in rows]
