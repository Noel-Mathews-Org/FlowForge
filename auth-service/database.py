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

