from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import Task, TaskApprovalRequest, TaskComment, TaskPriority, TaskStatus
from rbac import require_role
from schemas import (
    CommentCreate,
    CommentResponse,
    KanbanResponse,
    TaskAssignActivateRequest,
    TaskCreate,
    TaskPositionUpdate,
    TaskProposeMoveRequest,
    TaskResponse,
    TaskUpdate,
)
from services.redis_service import RedisAuditService
from services.email_service import send_notification_email

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _validate_status_transition(old_status: TaskStatus, new_status: TaskStatus) -> None:
    # Basic validations, managers can override
    pass


def _to_task_response(task: Task, include_comments: bool = False) -> TaskResponse:
    payload = TaskResponse.model_validate(task, from_attributes=True)
    if include_comments:
        payload.comments = [CommentResponse.model_validate(comment) for comment in task.comments]
    return payload


@router.get("/project/{project_id}", response_model=KanbanResponse)
async def get_project_tasks(project_id: UUID, assignee_id: UUID | None = None, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Task)
        .where(Task.project_id == project_id, Task.deleted_at.is_(None))
        .order_by(Task.status.asc(), Task.position.asc(), Task.created_at.asc())
        .options(selectinload(Task.comments))
    )
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    grouped = {
        "PENDING_APPROVAL": [],
        "PENDING_REVIEW": [],
        "TODO": [],
        "PENDING_PROGRESS": [],
        "IN_PROGRESS": [],
        "PENDING_DONE": [],
        "DONE": [],
    }
    for task in tasks:
        grouped[task.status.value].append(_to_task_response(task))
    return KanbanResponse(**grouped)


@router.get("/project/{project_id}/pending", response_model=list[TaskResponse], dependencies=[require_role("manager", "admin")])
async def get_pending_tasks(project_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Task)
        .where(
            Task.project_id == project_id,
            Task.deleted_at.is_(None),
            Task.status.in_([TaskStatus.PENDING_REVIEW, TaskStatus.PENDING_PROGRESS, TaskStatus.PENDING_DONE]),
        )
        .order_by(Task.created_at.asc())
        .options(selectinload(Task.comments))
    )
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return [_to_task_response(t) for t in tasks]


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = request.state.user_id
    user_email = request.state.user_email
    if not user_id or not user_email:
        raise HTTPException(status_code=401, detail="Missing user headers")

    count_stmt = select(func.count(Task.id)).where(Task.project_id == payload.project_id, Task.status == TaskStatus.PENDING_REVIEW, Task.deleted_at.is_(None))
    count_result = await db.execute(count_stmt)
    position = count_result.scalar_one()

    user_role = request.state.user_role or "member"
    initial_status = TaskStatus.PENDING_APPROVAL if user_role.lower() == "member" else TaskStatus.TODO

    task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        status=initial_status,
        priority=TaskPriority(payload.priority),
        assignee_id=payload.assignee_id,
        assignee_email=payload.assignee_email,
        created_by=UUID(user_id),
        created_by_email=user_email,
        position=position,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="task_created",
        user_id=user_id,
        user_email=user_email,
        project_id=str(task.project_id),
        task_id=str(task.id),
        metadata={"title": task.title, "status": task.status.value, "priority": task.priority.value},
    )
    return _to_task_response(task)


@router.post("/{task_id}/activate", response_model=TaskResponse, dependencies=[require_role("manager", "admin")])
async def activate_task(task_id: UUID, payload: TaskAssignActivateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status != TaskStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="Task is not in PENDING_REVIEW state")

    task.status = TaskStatus.TODO
    if payload.assignee_id and payload.assignee_email:
        task.assignee_id = payload.assignee_id
        task.assignee_email = payload.assignee_email

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)

    if task.assignee_email:
        await send_notification_email(task.assignee_email, "Task Activated and Assigned", f"You have been assigned to task: '{task.title}'")

    return _to_task_response(task)


@router.post("/{task_id}/propose-move", response_model=TaskResponse)
async def propose_move(task_id: UUID, payload: TaskProposeMoveRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if payload.target_status == "IN_PROGRESS" and task.status == TaskStatus.TODO:
        task.status = TaskStatus.PENDING_PROGRESS
    elif payload.target_status == "DONE" and task.status == TaskStatus.IN_PROGRESS:
        task.status = TaskStatus.PENDING_DONE
    else:
        raise HTTPException(status_code=400, detail="Invalid target status for current state")

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _to_task_response(task)


@router.post("/{task_id}/approve-move", response_model=TaskResponse, dependencies=[require_role("manager", "admin")])
async def approve_move(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    if task.status == TaskStatus.PENDING_PROGRESS:
        task.status = TaskStatus.IN_PROGRESS
    elif task.status == TaskStatus.PENDING_DONE:
        task.status = TaskStatus.DONE
    else:
        raise HTTPException(status_code=400, detail="No pending move to approve")

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)

    if task.assignee_email:
        await send_notification_email(task.assignee_email, "Task Move Approved", f"Your proposed move for '{task.title}' was approved. It is now {task.status.value}.")

    return _to_task_response(task)


@router.post("/{task_id}/reject-move", response_model=TaskResponse, dependencies=[require_role("manager", "admin")])
async def reject_move(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status == TaskStatus.PENDING_PROGRESS:
        task.status = TaskStatus.TODO
    elif task.status == TaskStatus.PENDING_DONE:
        task.status = TaskStatus.IN_PROGRESS
    else:
        raise HTTPException(status_code=400, detail="No pending move to reject")

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)

    if task.assignee_email:
        await send_notification_email(task.assignee_email, "Task Move Rejected", f"Your proposed move for '{task.title}' was rejected. It has been reverted to {task.status.value}.")

    return _to_task_response(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments))
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return _to_task_response(task, include_comments=True)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: UUID, payload: TaskUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    user_role = request.state.user_role or "member"
    
    if user_role.lower() == "member":
        # Create an approval request instead of updating directly
        import json
        proposal = TaskApprovalRequest(
            task_id=task.id,
            proposed_data=json.dumps(payload.model_dump(exclude_unset=True)),
            requested_by=UUID(request.state.user_id),
            requested_by_email=request.state.user_email
        )
        db.add(proposal)
        await db.commit()
        
        # Optionally mark the task as having a pending update if you add that field
        return _to_task_response(task)

    if payload.status is not None:
        task.status = TaskStatus(payload.status)

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
    await db.refresh(task)

    return _to_task_response(task)


@router.patch("/{task_id}/position", response_model=TaskResponse)
async def update_task_position(task_id: UUID, payload: TaskPositionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    target_status = TaskStatus(payload.status)
    old_status = task.status
    old_position = task.position
    if old_status == target_status and old_position == payload.position:
        return _to_task_response(task)

    # Simplified position updates to just swap the task position
    task.position = payload.position
    task.status = target_status
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _to_task_response(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[require_role("manager", "admin")])
async def delete_task(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).options(selectinload(Task.comments)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.deleted_at = datetime.now(timezone.utc)
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@router.get("/{task_id}/comments", response_model=list[CommentResponse])
async def list_comments(task_id: UUID, db: AsyncSession = Depends(get_db)):
    task_result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    result = await db.execute(select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc()))
    comments = result.scalars().all()
    return [CommentResponse.model_validate(comment) for comment in comments]


@router.get("/internal/approvals", response_model=list[TaskResponse])
async def get_internal_approvals(project_ids: list[UUID] = Query(...), db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Task)
        .where(Task.project_id.in_(project_ids), Task.status == TaskStatus.PENDING_APPROVAL, Task.deleted_at.is_(None))
        .options(selectinload(Task.comments))
    )
    result = await db.execute(stmt)
    return [_to_task_response(t) for t in result.scalars().all()]


@router.post("/internal/{task_id}/approve", response_model=TaskResponse)
async def approve_task_internal(task_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id).options(selectinload(Task.comments))
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = TaskStatus.TODO
    await db.commit()
    await db.refresh(task)
    return _to_task_response(task)


@router.post("/internal/{task_id}/reject", response_model=TaskResponse)
async def reject_task_internal(task_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id).options(selectinload(Task.comments))
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = TaskStatus.REJECTED
    await db.commit()
    await db.refresh(task)
    return _to_task_response(task)
