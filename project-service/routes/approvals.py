from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import Project
from rbac import require_role

router = APIRouter(prefix="/projects", tags=["approvals"])


@router.get("/approvals")
async def list_task_approvals(request: Request, db: AsyncSession = Depends(get_db)):
    role = getattr(request.state, "user_role", "").lower()
    if role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user_id_str = request.state.user_id
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_id = UUID(user_id_str)
    
    # 1. Get projects managed by this user
    if role == "admin":
        stmt = select(Project.id)
    else:
        stmt = select(Project.id).where(Project.manager_id == user_id)
    
    result = await db.execute(stmt)
    project_ids = [str(pid) for pid in result.scalars().all()]
    
    if not project_ids:
        return []

    # 2. Call task-service
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{settings.task_service_url}/tasks/internal/approvals",
                params={"project_ids": project_ids}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {resp.text}")
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Communication error: {str(e)}")


@router.post("/approvals/{task_id}/approve")
async def approve_task(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    role = getattr(request.state, "user_role", "").lower()
    if role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f"{settings.task_service_url}/tasks/internal/{task_id}/approve")
            if resp.status_code != 200:
                 raise HTTPException(status_code=resp.status_code, detail=f"Approval failed: {resp.text}")
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Communication error: {str(e)}")


@router.post("/approvals/{task_id}/reject")
async def reject_task(task_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    role = getattr(request.state, "user_role", "").lower()
    if role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
        
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f"{settings.task_service_url}/tasks/internal/{task_id}/reject")
            if resp.status_code != 200:
                 raise HTTPException(status_code=resp.status_code, detail=f"Rejection failed: {resp.text}")
            return resp.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Communication error: {str(e)}")