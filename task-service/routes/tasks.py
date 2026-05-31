"""
Task service routes. Key flows:
 - Manager creates/updates → direct, no approval
 - Member creates → TODO status, no approval
 - Member marks as DONE → sets needs_approval=True, creates ApprovalRequest
 - Manager approves → status=DONE, notifies assignee
 - Manager rejects → reverts proposed_status, notifies assignee
"""
import os
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import ApprovalRequest, Task, TaskComment, TaskStatus, TaskPriority
from rbac import require_role
from schemas import (
    ApprovalRejectRequest,
    CommentCreate,
    CommentResponse,
    KanbanResponse,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from services.redis_service import RedisAuditService

router = APIRouter(prefix="/tasks", tags=["tasks"])

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "")
MANAGER_ROLES = {"manager", "platform_admin"}
ALL_ROLES = {"platform_admin", "org_owner", "manager", "member"}


def _to_response(task: Task) -> TaskResponse:
    return TaskResponse.model_validate(task, from_attributes=True)


async def _notify(user_id: str, ntype: str, title: str, content: str, meta: dict):
    """Fire-and-forget notification to auth-service."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{AUTH_SERVICE_URL}/internal/notifications",
                json={"user_id": user_id, "type": ntype, "title": title, "content": content, "metadata": meta},
                headers={"X-Internal-Token": INTERNAL_TOKEN},
            )
    except Exception:
        pass


# ─── Kanban board ────────────────────────────────────────────────────────────

@router.get("/project/{project_id}", response_model=KanbanResponse)
async def get_project_tasks(project_id: UUID, assignee_id: UUID | None = None, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Task)
        .where(Task.project_id == project_id, Task.deleted_at.is_(None))
        .order_by(Task.position.asc(), Task.created_at.asc())
        .options(selectinload(Task.comments))
    )
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    tasks = (await db.execute(stmt)).scalars().all()

    grouped: dict[str, list] = {"TODO": [], "IN_PROGRESS": [], "DONE": [], "BLOCKED": []}
    for t in tasks:
        key = t.status if t.status in grouped else "TODO"
        grouped[key].append(_to_response(t))
    return KanbanResponse(**grouped)


# ─── Pending approvals (manager view) ────────────────────────────────────────

@router.get("/pending-approvals", response_model=list[TaskResponse], dependencies=[require_role("manager", "platform_admin")])
async def get_pending_approvals(
    request: Request,
    project_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    user_id_str = getattr(request.state, "user_id", None)
    role = getattr(request.state, "user_role", "")
    stmt = (
        select(Task)
        .where(Task.deleted_at.is_(None), Task.needs_approval == True)
        .options(selectinload(Task.comments))
    )
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    tasks = (await db.execute(stmt)).scalars().all()
    return [_to_response(t) for t in tasks]


@router.get("/project/{project_id}/pending", response_model=list[TaskResponse], dependencies=[require_role("manager", "platform_admin")])
async def get_pending_approvals_by_project(
    project_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Task)
        .where(Task.project_id == project_id, Task.deleted_at.is_(None), Task.needs_approval == True)
        .options(selectinload(Task.comments))
    )
    tasks = (await db.execute(stmt)).scalars().all()
    return [_to_response(t) for t in tasks]


# ─── Internal: list approvals by project_ids ─────────────────────────────────

@router.get("/internal/approvals")
async def internal_approvals(
    project_ids: list[str] = Query(default=[]),
    db: AsyncSession = Depends(get_db),
    x_internal_token: str | None = None,
):
    stmt = (
        select(Task)
        .where(Task.deleted_at.is_(None), Task.needs_approval == True, Task.project_id.in_([UUID(p) for p in project_ids]))
        .options(selectinload(Task.comments))
    )
    tasks = (await db.execute(stmt)).scalars().all()
    return [_to_response(t).model_dump() for t in tasks]


# ─── Create ──────────────────────────────────────────────────────────────────

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = request.state.user_id
    user_email = request.state.user_email
    if not user_id or not user_email:
        raise HTTPException(401, "Missing user headers")

    count = await db.scalar(
        select(func.count(Task.id)).where(Task.project_id == payload.project_id, Task.deleted_at.is_(None))
    )
    user_role = (request.state.user_role or "member").lower()
    # Members create tasks in TODO; no approval needed at creation time
    task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        status="TODO",
        priority=payload.priority or "MEDIUM",
        assignee_id=payload.assignee_id,
        assignee_email=payload.assignee_email,
        created_by=UUID(user_id),
        created_by_email=user_email,
        position=count or 0,
    )
    db.add(task)
    await db.commit()

    stmt = select(Task).where(Task.id == task.id).options(selectinload(Task.comments))
    task = (await db.execute(stmt)).scalar_one()

    if task.assignee_id and str(task.assignee_id) != user_id:
        await _notify(
            str(task.assignee_id), "task_assigned",
            f"New Task: {task.title}",
            f"You've been assigned '{task.title}' by {user_email}.",
            {"task_id": str(task.id), "project_id": str(task.project_id)},
        )

    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="task_created", user_id=user_id, user_email=user_email,
        project_id=str(task.project_id), task_id=str(task.id), metadata={"title": task.title}
    )
    return _to_response(task)


# ─── Update ──────────────────────────────────────────────────────────────────

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: UUID, payload: TaskUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    user_role = (request.state.user_role or "member").lower()
    user_id = request.state.user_id

    if user_role == "member":
        # Members can update title/description/priority but NOT status directly
        if payload.title is not None:
            task.title = payload.title
        if payload.description is not None:
            task.description = payload.description
        if payload.priority is not None:
            task.priority = payload.priority
        # Status change: member wants DONE → set needs_approval
        if payload.status is not None:
            if payload.status == "DONE":
                task.proposed_status = "DONE"
                task.needs_approval = True
                task.proposed_by = UUID(user_id)
                # Create ApprovalRequest record
                ar = ApprovalRequest(
                    task_id=task.id,
                    requested_by=UUID(user_id),
                    requested_status="DONE",
                    status="PENDING",
                )
                db.add(ar)
                
                # Fetch project from project-service to get manager_id
                import httpx
                import os
                project_url = os.getenv("PROJECT_SERVICE_URL", "http://project-service:8002")
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        resp = await client.get(
                            f"{project_url}/projects/{task.project_id}",
                            headers={
                                "X-User-ID": request.state.user_id,
                                "X-User-Role": getattr(request.state, "user_role", "")
                            }
                        )
                        if resp.status_code == 200:
                            project = resp.json()
                            manager_id = project.get("manager_id")
                            if manager_id:
                                await _notify(
                                    str(manager_id), "approval_needed",
                                    f"Approval Needed: {task.title}",
                                    f"Task '{task.title}' has been marked as DONE and requires your approval.",
                                    {"task_id": str(task.id), "project_id": str(task.project_id)},
                                )
                except Exception as e:
                    pass  # Silent fail on notification if project service is down
            else:
                # Non-DONE status changes (IN_PROGRESS, BLOCKED) are allowed directly for members
                task.status = payload.status
    else:
        # Managers / admins can update everything directly
        if payload.status is not None:
            task.status = payload.status
            task.needs_approval = False
            task.proposed_status = None
        if payload.title is not None:
            task.title = payload.title
        if payload.description is not None:
            task.description = payload.description
        if payload.priority is not None:
            task.priority = payload.priority
        if payload.assignee_id is not None:
            old_assignee = task.assignee_id
            task.assignee_id = payload.assignee_id
            task.assignee_email = payload.assignee_email
            if payload.assignee_id and str(payload.assignee_id) != str(old_assignee):
                await _notify(
                    str(payload.assignee_id), "task_assigned",
                    f"Task Assigned: {task.title}",
                    f"You've been assigned '{task.title}'.",
                    {"task_id": str(task.id), "project_id": str(task.project_id)},
                )
        if payload.position is not None:
            task.position = payload.position

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task, attribute_names=["comments"])
    return _to_response(task)


# ─── Approve ─────────────────────────────────────────────────────────────────

@router.post("/{task_id}/approve", response_model=TaskResponse, dependencies=[require_role("manager", "platform_admin")])
async def approve_task(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    if not task.needs_approval:
        raise HTTPException(400, "Task does not need approval")

    reviewer_id = UUID(request.state.user_id)

    if task.proposed_status:
        task.status = task.proposed_status
    task.needs_approval = False
    task.proposed_status = None
    task.proposed_by = None
    task.updated_at = datetime.now(timezone.utc)

    # Update ApprovalRequest records
    pending_ars = (await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.task_id == task_id, ApprovalRequest.status == "PENDING")
    )).scalars().all()
    for pending_ar in pending_ars:
        pending_ar.status = "APPROVED"
        pending_ar.reviewed_by = reviewer_id
        pending_ar.resolved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(task, attribute_names=["comments"])

    if task.assignee_id:
        await _notify(
            str(task.assignee_id), "task_approved",
            f"Task Approved: {task.title}",
            f"Your task '{task.title}' has been approved. Status: {task.status}.",
            {"task_id": str(task.id), "project_id": str(task.project_id)},
        )

    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="approval_resolved", user_id=request.state.user_id, user_email=request.state.user_email,
        project_id=str(task.project_id), task_id=str(task.id), metadata={"action": "approved", "new_status": task.status}
    )
    return _to_response(task)


# ─── Reject ──────────────────────────────────────────────────────────────────

@router.post("/{task_id}/reject", response_model=TaskResponse, dependencies=[require_role("manager", "platform_admin")])
async def reject_task(task_id: UUID, payload: ApprovalRejectRequest, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    if not task.needs_approval:
        raise HTTPException(400, "Task does not need approval")

    reviewer_id = UUID(request.state.user_id)
    task.needs_approval = False
    task.proposed_status = None
    task.proposed_by = None
    task.updated_at = datetime.now(timezone.utc)

    pending_ars = (await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.task_id == task_id, ApprovalRequest.status == "PENDING")
    )).scalars().all()
    for pending_ar in pending_ars:
        pending_ar.status = "REJECTED"
        pending_ar.reviewed_by = reviewer_id
        pending_ar.review_comment = payload.comment
        pending_ar.resolved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(task, attribute_names=["comments"])

    if task.assignee_id:
        await _notify(
            str(task.assignee_id), "task_rejected",
            f"Task Rejected: {task.title}",
            f"Your completion request for '{task.title}' was rejected. Reason: {payload.comment or 'No reason given'}.",
            {"task_id": str(task.id), "project_id": str(task.project_id)},
        )

    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="approval_resolved", user_id=request.state.user_id, user_email=request.state.user_email,
        project_id=str(task.project_id), task_id=str(task.id), metadata={"action": "rejected"}
    )
    return _to_response(task)


# ─── Get / Delete ────────────────────────────────────────────────────────────

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    return _to_response(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[require_role("manager", "platform_admin")])
async def delete_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    task.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Comments ────────────────────────────────────────────────────────────────

@router.post("/{task_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(task_id: UUID, payload: CommentCreate, request: Request, db: AsyncSession = Depends(get_db)):
    task = (await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    comment = TaskComment(
        task_id=task.id, author_id=UUID(request.state.user_id),
        author_email=request.state.user_email, body=payload.body
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentResponse.model_validate(comment)


@router.get("/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(task_id: UUID, db: AsyncSession = Depends(get_db)):
    task = (await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))).scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    result = await db.execute(
        select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc())
    )
    return [CommentResponse.model_validate(c) for c in result.scalars().all()]
