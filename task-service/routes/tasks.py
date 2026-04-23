from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import Task, TaskComment, TaskPriority, TaskStatus
from rbac import require_role
from schemas import CommentCreate, CommentResponse, KanbanResponse, TaskCreate, TaskPositionUpdate, TaskResponse, TaskUpdate
from services.redis_service import RedisAuditService

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _validate_status_transition(old_status: TaskStatus, new_status: TaskStatus) -> None:
    if old_status == new_status:
        return
    if old_status == TaskStatus.TODO and new_status == TaskStatus.DONE:
        raise HTTPException(status_code=400, detail="Cannot skip In Progress")
    if old_status == TaskStatus.DONE and new_status == TaskStatus.TODO:
        raise HTTPException(status_code=400, detail="Must reopen to In Progress first")
    if (
        (old_status == TaskStatus.TODO and new_status == TaskStatus.IN_PROGRESS)
        or (old_status == TaskStatus.IN_PROGRESS and new_status == TaskStatus.DONE)
        or (old_status == TaskStatus.DONE and new_status == TaskStatus.IN_PROGRESS)
    ):
        return
    raise HTTPException(status_code=400, detail="Invalid status transition")


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
    )
    if assignee_id:
        stmt = stmt.where(Task.assignee_id == assignee_id)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    grouped = {"TODO": [], "IN_PROGRESS": [], "DONE": []}
    for task in tasks:
        grouped[task.status.value].append(_to_task_response(task))
    return KanbanResponse(**grouped)


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, request: Request, db: AsyncSession = Depends(get_db)):
    user_id = request.state.user_id
    user_email = request.state.user_email
    if not user_id or not user_email:
        raise HTTPException(status_code=401, detail="Missing user headers")

    count_stmt = select(func.count(Task.id)).where(Task.project_id == payload.project_id, Task.status == TaskStatus.TODO, Task.deleted_at.is_(None))
    count_result = await db.execute(count_stmt)
    position = count_result.scalar_one()

    task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
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
        metadata={"title": task.title, "status": task.status.value, "priority": task.priority.value, "position": task.position},
    )
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
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = task.status
    status_changed = False
    if payload.status is not None:
        new_status = TaskStatus(payload.status)
        _validate_status_transition(old_status, new_status)
        status_changed = new_status != old_status
        task.status = new_status

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

    audit: RedisAuditService = request.app.state.audit_service
    event_type = "task_moved" if status_changed else "task_updated"
    metadata = {"title": task.title}
    if status_changed:
        metadata.update({"old_status": old_status.value, "new_status": task.status.value})
    await audit.emit_event(
        event_type=event_type,
        user_id=request.state.user_id or "",
        user_email=request.state.user_email or "",
        project_id=str(task.project_id),
        task_id=str(task.id),
        metadata=metadata,
    )
    return _to_task_response(task)


@router.patch("/{task_id}/position", response_model=TaskResponse)
async def update_task_position(task_id: UUID, payload: TaskPositionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    target_status = TaskStatus(payload.status)
    old_status = task.status
    old_position = task.position
    if old_status == target_status and old_position == payload.position:
        return _to_task_response(task)

    if old_status == target_status:
        if payload.position < old_position:
            await db.execute(
                update(Task)
                .where(Task.project_id == task.project_id, Task.status == old_status, Task.deleted_at.is_(None), Task.id != task.id, Task.position >= payload.position, Task.position < old_position)
                .values(position=Task.position + 1)
            )
        else:
            await db.execute(
                update(Task)
                .where(Task.project_id == task.project_id, Task.status == old_status, Task.deleted_at.is_(None), Task.id != task.id, Task.position <= payload.position, Task.position > old_position)
                .values(position=Task.position - 1)
            )
    else:
        await db.execute(
            update(Task)
            .where(Task.project_id == task.project_id, Task.status == old_status, Task.deleted_at.is_(None), Task.id != task.id, Task.position > old_position)
            .values(position=Task.position - 1)
        )
        await db.execute(
            update(Task)
            .where(Task.project_id == task.project_id, Task.status == target_status, Task.deleted_at.is_(None), Task.position >= payload.position)
            .values(position=Task.position + 1)
        )
        task.status = target_status

    task.position = payload.position
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _to_task_response(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[require_role("manager", "admin")])
async def delete_task(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.deleted_at = datetime.now(timezone.utc)
    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="task_deleted",
        user_id=request.state.user_id or "",
        user_email=request.state.user_email or "",
        project_id=str(task.project_id),
        task_id=str(task.id),
        metadata={"deleted_at": task.deleted_at.isoformat()},
    )
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
    audit: RedisAuditService = request.app.state.audit_service
    await audit.emit_event(
        event_type="comment_added",
        user_id=user_id,
        user_email=user_email,
        project_id=str(task.project_id),
        task_id=str(task.id),
        metadata={"comment_id": str(comment.id)},
    )
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
