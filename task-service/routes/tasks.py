from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import Task, TaskComment, TaskPriority, TaskStatus
from rbac import require_role
from schemas import (
    CommentCreate,
    CommentResponse,
    KanbanResponse,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from services.redis_service import RedisAuditService
from services.email_service import send_notification_email

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _to_task_response(task: Task, include_comments: bool = False) -> TaskResponse:
    payload = TaskResponse.model_validate(task, from_attributes=True)
    if include_comments:
        payload.comments = [CommentResponse.model_validate(comment) for comment in task.comments]
    return payload


# ---------------------------------------------------------------------------
# GET  /tasks/project/{project_id}          — Kanban board data
# ---------------------------------------------------------------------------
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
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    grouped: dict[str, list[TaskResponse]] = {
        "TODO": [],
        "IN_PROGRESS": [],
        "DONE": [],
    }
    for task in tasks:
        key = task.status.value
        if key in grouped:
            grouped[key].append(_to_task_response(task))

    return KanbanResponse(**grouped)


# ---------------------------------------------------------------------------
# GET  /tasks/project/{project_id}/pending  — Manager: pending approvals
# ---------------------------------------------------------------------------
@router.get("/project/{project_id}/pending", response_model=list[TaskResponse], dependencies=[require_role("manager", "admin")])
async def get_pending_tasks(project_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Task)
        .where(
            Task.project_id == project_id,
            Task.deleted_at.is_(None),
            Task.needs_approval == True,
        )
        .order_by(Task.created_at.asc())
        .options(selectinload(Task.comments))
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return [_to_task_response(t) for t in tasks]


# ---------------------------------------------------------------------------
# POST /tasks/                              — Create a task
# ---------------------------------------------------------------------------
@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = request.state.user_id
    user_email = request.state.user_email
    if not user_id or not user_email:
        raise HTTPException(status_code=401, detail="Missing user headers")

    # Determine position
    count_stmt = select(func.count(Task.id)).where(
        Task.project_id == payload.project_id,
        Task.deleted_at.is_(None)
    )
    count_result = await db.execute(count_stmt)
    position = count_result.scalar_one()

    # Approval Workflow: Role-based
    user_role = (request.state.user_role or "member").lower()
    needs_approval = user_role == "member"

    task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        status=TaskStatus.TODO,
        priority=TaskPriority(payload.priority),
        assignee_id=payload.assignee_id,
        assignee_email=payload.assignee_email,
        created_by=UUID(user_id),
        created_by_email=user_email,
        position=position,
        needs_approval=needs_approval,
        proposed_by=UUID(user_id) if needs_approval else None,
    )
    db.add(task)
    await db.commit()

    # Re-fetch with selectinload
    stmt = select(Task).where(Task.id == task.id).options(selectinload(Task.comments))
    task = (await db.execute(stmt)).scalar_one()

    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="task_created",
        user_id=user_id,
        user_email=user_email,
        project_id=str(task.project_id),
        task_id=str(task.id),
        metadata={"title": task.title, "status": task.status.value, "priority": task.priority.value, "needs_approval": needs_approval},
    )
    return _to_task_response(task)


# ---------------------------------------------------------------------------
# PUT  /tasks/{task_id}                     — Update a task
# ---------------------------------------------------------------------------
@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: UUID, payload: TaskUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_role = (request.state.user_role or "member").lower()

    if user_role == "member":
        # Members cannot directly change status — set proposed_status instead
        if payload.status is not None:
            task.proposed_status = payload.status
            task.needs_approval = True
            task.proposed_by = UUID(request.state.user_id)
        # Allow members to update non-status fields
        if payload.title is not None:
            task.title = payload.title
        if payload.description is not None:
            task.description = payload.description
        if payload.priority is not None:
            task.priority = TaskPriority(payload.priority)
    else:
        # Managers/admins can update everything directly
        if payload.status is not None:
            task.status = TaskStatus(payload.status)
            task.needs_approval = False
            task.proposed_status = None
        if payload.title is not None:
            task.title = payload.title
        if payload.description is not None:
            task.description = payload.description
        if payload.priority is not None:
            task.priority = TaskPriority(payload.priority)
        if payload.assignee_id is not None or payload.assignee_email is not None:
            task.assignee_id = payload.assignee_id
            task.assignee_email = payload.assignee_email
        if payload.position is not None:
            task.position = payload.position

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task, attribute_names=["comments"])

    return _to_task_response(task)


# ---------------------------------------------------------------------------
# POST /tasks/{task_id}/approve             — Manager approves pending task
# ---------------------------------------------------------------------------
@router.post("/{task_id}/approve", response_model=TaskResponse, dependencies=[require_role("manager", "admin")])
async def approve_task(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.needs_approval:
        raise HTTPException(status_code=400, detail="Task does not need approval")

    # If there's a proposed status change, apply it
    if task.proposed_status:
        try:
            task.status = TaskStatus(task.proposed_status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid proposed status: {task.proposed_status}")

    # Clear approval flags
    task.needs_approval = False
    task.proposed_status = None
    task.proposed_by = None
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task, attribute_names=["comments"])

    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="approval_resolved",
        user_id=request.state.user_id,
        user_email=request.state.user_email,
        project_id=str(task.project_id),
        task_id=str(task.id),
        metadata={"action": "approved", "new_status": task.status.value},
    )

    if task.assignee_email:
        await send_notification_email(
            task.assignee_email,
            "Task Approved",
            f"Task '{task.title}' has been approved. Status: {task.status.value}."
        )

    return _to_task_response(task)


# ---------------------------------------------------------------------------
# POST /tasks/{task_id}/reject              — Manager rejects pending task
# ---------------------------------------------------------------------------
@router.post("/{task_id}/reject", response_model=TaskResponse, dependencies=[require_role("manager", "admin")])
async def reject_task(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.needs_approval:
        raise HTTPException(status_code=400, detail="Task does not need approval")

    # Discard proposed changes, keep current status
    task.needs_approval = False
    task.proposed_status = None
    task.proposed_by = None
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task, attribute_names=["comments"])

    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="approval_resolved",
        user_id=request.state.user_id,
        user_email=request.state.user_email,
        project_id=str(task.project_id),
        task_id=str(task.id),
        metadata={"action": "rejected"},
    )

    if task.assignee_email:
        await send_notification_email(
            task.assignee_email,
            "Task Rejected",
            f"The change request for '{task.title}' was rejected."
        )

    return _to_task_response(task)


# ---------------------------------------------------------------------------
# GET  /tasks/{task_id}                     — Single task detail
# ---------------------------------------------------------------------------
@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _to_task_response(task, include_comments=True)


# ---------------------------------------------------------------------------
# DELETE /tasks/{task_id}                   — Soft-delete
# ---------------------------------------------------------------------------
@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[require_role("manager", "admin")])
async def delete_task(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.deleted_at = datetime.now(timezone.utc)
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# POST /tasks/{task_id}/comments            — Add comment
# ---------------------------------------------------------------------------
@router.post("/{task_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(task_id: UUID, payload: CommentCreate, request: Request, db: AsyncSession = Depends(get_db)):
    task_result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    user_id = request.state.user_id
    user_email = request.state.user_email
    if not user_id or not user_email:
        raise HTTPException(status_code=401, detail="Missing user headers")

    comment = TaskComment(task_id=task.id, author_id=UUID(user_id), author_email=user_email, body=payload.body)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentResponse.model_validate(comment)


# ---------------------------------------------------------------------------
# GET  /tasks/{task_id}/comments            — List comments
# ---------------------------------------------------------------------------
@router.get("/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(task_id: UUID, db: AsyncSession = Depends(get_db)):
    task_result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc()))
    comments = result.scalars().all()
    return [CommentResponse.model_validate(comment) for comment in comments]
