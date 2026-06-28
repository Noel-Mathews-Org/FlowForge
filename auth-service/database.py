import logging
import uuid
from urllib.parse import quote_plus

import bcrypt
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings

logger = logging.getLogger("auth-service")


class Base(DeclarativeBase):
    pass


def _get_entra_token() -> str:
    """Acquire an Entra ID access token for Azure PostgreSQL."""
    from azure.identity import DefaultAzureCredential
    credential = DefaultAzureCredential()
    token = credential.get_token("https://ossrdbms-aad.database.windows.net/.default")
    return token.token


def _build_database_url() -> str:
    """Build the database URL — either from Managed Identity or static connection string."""
    if settings.use_managed_identity_db:
        token = _get_entra_token()
        user = quote_plus(settings.managed_identity_name)
        password = quote_plus(token)
        host = settings.postgres_host
        db_name = settings.postgres_db_name
        return f"postgresql+asyncpg://{user}:{password}@{host}/{db_name}?ssl=require"
    else:
        return settings.database_url


engine = create_async_engine(_build_database_url(), future=True, echo=False)

# Hook: refresh the Entra ID token on every new physical connection
if settings.use_managed_identity_db:
    @event.listens_for(engine.sync_engine, "do_connect")
    def _on_connect(dialect, conn_rec, cargs, cparams):
        token = _get_entra_token()
        cparams["password"] = token

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    from models import Invitation, Notification, RefreshToken, User  # noqa: F401 — register tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
