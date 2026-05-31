import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from redis.asyncio import Redis

from config import settings
from database import Base, engine
from rbac import HeaderExtractionMiddleware
from routes.tasks import router as tasks_router
from services.redis_service import RedisAuditService

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    app.state.redis_client = redis_client
    app.state.audit_service = RedisAuditService(redis_client)
    try:
        await redis_client.ping()
    except Exception:
        logger.warning("Redis unavailable at startup — audit events disabled")
    yield
    await redis_client.close()
    await engine.dispose()


app = FastAPI(title="FlowForge Task Service", lifespan=lifespan)
app.add_middleware(HeaderExtractionMiddleware)
app.include_router(tasks_router)


@app.get("/health")
async def healthcheck():
    return {"status": "healthy", "service": "task-service"}
