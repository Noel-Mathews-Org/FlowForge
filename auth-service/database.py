import logging
import uuid

import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select

from config import settings

logger = logging.getLogger("auth-service")


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url, future=True, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    from models import Invitation, Notification, RefreshToken, User  # noqa: F401 — register tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _bootstrap()


async def _bootstrap() -> None:
    """Create default platform_admin and org_owner on first startup. Idempotent."""
    from models import User

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.role == "platform_admin").limit(1)
        )
        if result.scalar_one_or_none():
            return  # Already bootstrapped

        org_id = uuid.UUID(settings.default_org_id)

        def _hash(pw: str) -> str:
            return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()

        admin = User(
            org_id=org_id,
            email="admin@flowforge.com",
            hashed_password=_hash("Admin123!"),
            full_name="Platform Admin",
            role="platform_admin",
            must_reset_password=True,
            is_active=True,
        )
        owner = User(
            org_id=org_id,
            email="owner@flowforge.com",
            hashed_password=_hash("Owner123!"),
            full_name="Org Owner",
            role="org_owner",
            must_reset_password=True,
            is_active=True,
        )
        db.add(admin)
        db.add(owner)
        await db.commit()
        logger.info("Bootstrap complete: admin@flowforge.com and owner@flowforge.com created (force reset required)")
