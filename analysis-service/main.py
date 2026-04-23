import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from redis.asyncio import Redis

from config import settings
from database import AsyncSessionLocal, Base, engine
from rbac import HeaderExtractionMiddleware
from routes.analytics import router as analytics_router
from workers.stream_consumer import consume_stream


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    app.state.redis_client = redis_client
    consumer_task = asyncio.create_task(consume_stream(redis_client, AsyncSessionLocal))
    app.state.consumer_task = consumer_task
    yield
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass
    await redis_client.close()
    await engine.dispose()


app = FastAPI(title="FlowForge Analytics Service", lifespan=lifespan)
app.add_middleware(HeaderExtractionMiddleware)
app.include_router(analytics_router)


@app.get("/health")
async def healthcheck():
    return {"status": "ok", "service": "analysis-service"}
