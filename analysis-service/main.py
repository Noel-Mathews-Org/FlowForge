import asyncio
import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from redis.asyncio import Redis

from config import settings
from database import AsyncSessionLocal, Base, engine
from rbac import HeaderExtractionMiddleware
from routes import ai, analytics, reports
from workers.aggregator import aggregation_scheduler
from workers.stream_consumer import consume_stream


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    app.state.redis_client = redis_client

    consumer_task   = None
    aggregator_task = None
    try:
        await redis_client.ping()
        consumer_task = asyncio.create_task(consume_stream(redis_client, AsyncSessionLocal))
        app.state.consumer_task = consumer_task
    except Exception:
        pass  # Redis unavailable — core analytics still works

    aggregator_task = asyncio.create_task(aggregation_scheduler())
    app.state.aggregator_task = aggregator_task

    yield

    for task in (consumer_task, aggregator_task):
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    await redis_client.aclose()
    await engine.dispose()


app = FastAPI(title="FlowForge Analytics & AI Service", lifespan=lifespan)
app.add_middleware(HeaderExtractionMiddleware)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(reports.router)


@app.get("/health")
async def healthcheck():
    redis_ok = False
    try:
        redis_client: Redis = app.state.redis_client
        await redis_client.ping()
        redis_ok = True
    except Exception:
        pass
    return {
        "status": "healthy",
        "service": "analysis-service",
        "redis": "up" if redis_ok else "degraded",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    }
