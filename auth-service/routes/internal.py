import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt

from config import settings
from database import get_db
from models import User
from schemas import UserProfile

router = APIRouter(prefix="/internal", tags=["internal"])

@router.get("/user-by-email", response_model=UserProfile)
async def get_user_by_email(email: str, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return UserProfile(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        org=user.org,
        is_active=user.is_active,
        created_at=user.created_at,
    )

from pydantic import BaseModel

class InternalCreateUser(BaseModel):
    email: str
    full_name: str
    role: str = "member"
    org: str = "Default"
    temp_password: str

@router.post("/create-user", response_model=UserProfile)
async def create_user_internal(payload: InternalCreateUser, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    new_user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=bcrypt.hashpw(payload.temp_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        role=payload.role,
        org=payload.org,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserProfile(
        id=str(new_user.id),
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role.value,
        org=new_user.org,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
    )
