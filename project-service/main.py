from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import asyncio
from config import settings
from database import init_db, SessionLocal
from rbac import HeaderExtractionMiddleware
from routes.approvals import router as approvals_router
from routes.projects import router as projects_router
from services.redis_service import close_redis, connect_redis, get_redis
from workers.stream_consumer import consume_stream


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    await connect_redis()
    
    redis_client = get_redis()
    task = asyncio.create_task(consume_stream(redis_client, SessionLocal))
    
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await close_redis()


app = FastAPI(title="FlowForge Project & Approval Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(HeaderExtractionMiddleware)

app.include_router(approvals_router)
app.include_router(projects_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
