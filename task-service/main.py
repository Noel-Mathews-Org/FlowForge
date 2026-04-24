import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from redis.asyncio import Redis
from sqlalchemy import text

from config import settings
from database import Base, engine
from rbac import HeaderExtractionMiddleware
from routes.tasks import router as tasks_router
from services.redis_service import RedisAuditService

logger = logging.getLogger(__name__)

_REQUIRED_ENUM_VALUES = ["PENDING_REVIEW", "PENDING_PROGRESS", "PENDING_DONE"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Ensure the PostgreSQL task_status enum has all required values.
        # ALTER TYPE … ADD VALUE cannot run inside a multi-statement transaction
        # on older PG, but asyncpg runs each statement in its own implicit txn
        # when we use raw_connection.  We use the high-level `text()` approach
        # which works fine for PG ≥ 12 with IF NOT EXISTS.
        await conn.run_sync(Base.metadata.create_all)

        for value in _REQUIRED_ENUM_VALUES:
            try:
                await conn.execute(
                    text(f"ALTER TYPE task_status ADD VALUE IF NOT EXISTS '{value}'")
                )
            except Exception as exc:
                # Type may not exist yet (first run) – create_all will handle it.
                logger.debug("ALTER TYPE task_status skipped for %s: %s", value, exc)

    redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    app.state.redis_client = redis_client
    app.state.audit_service = RedisAuditService(redis_client)
    yield
    await redis_client.close()
    await engine.dispose()


app = FastAPI(title="FlowForge Task Service", lifespan=lifespan)
app.add_middleware(HeaderExtractionMiddleware)
app.include_router(tasks_router)


@app.get("/health")
async def healthcheck():
    return {"status": "ok", "service": "task-service"}
