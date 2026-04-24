import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, UserRole
from schemas import InternalCreateUser, UserProfile

# Router without prefix - prefix will be set during app.include_router in main.py
router = APIRouter(tags=["internal"])


@router.get("/user-by-email", response_model=UserProfile)
async def get_user_by_email(email: str, db: AsyncSession = Depends(get_db)):
    """
    Service-to-service route to look up a user by email.
    No JWT required.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserProfile(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        org=user.org,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post("/create-user", response_model=UserProfile, status_code=status.HTTP_201_CREATED)
async def create_user_internal(payload: InternalCreateUser, db: AsyncSession = Depends(get_db)):
    """
    Service-to-service route to create a new user (e.g. when added to a project).
    No JWT required. No email sent from here.
    """
    # 1. Check if user already exists
    existing_result = await db.execute(select(User).where(User.email == payload.email))
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists"
        )

    # 2. Hash password using bcrypt (same as auth.py)
    hashed_password = bcrypt.hashpw(
        payload.temp_password.encode("utf-8"), 
        bcrypt.gensalt()
    ).decode("utf-8")

    # 3. Determine role
    try:
        user_role = UserRole(payload.role)
    except ValueError:
        user_role = UserRole.member

    # 4. Create user
    new_user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hashed_password,
        role=user_role,
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
