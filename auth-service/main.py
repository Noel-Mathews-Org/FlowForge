from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routes import admin, auth
from services.redis_service import get_redis


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    redis = get_redis()
    await redis.ping()
    try:
        yield
    finally:
        await redis.close()


app = FastAPI(title="FlowForge Auth Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth-service"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=False)
