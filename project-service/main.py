import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db, AsyncSessionLocal
from rbac import HeaderExtractionMiddleware
from routes.projects import router as projects_router
from services.redis_service import connect_redis, close_redis, get_redis


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await connect_redis()
    # Stream consumer is optional — if it fails, core CRUD still works
    consumer_task = None
    try:
        from workers.stream_consumer import consume_stream
        redis_client = get_redis()
        consumer_task = asyncio.create_task(consume_stream(redis_client, AsyncSessionLocal))
    except Exception:
        pass
    yield
    if consumer_task:
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass
    await close_redis()


app = FastAPI(title="FlowForge Project Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(HeaderExtractionMiddleware)
app.include_router(projects_router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "project-service"}
