from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routes import admin, auth, internal
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

# Public Auth Routes (/auth/login, /auth/register, etc.)
app.include_router(auth.router)

# Admin Routes (/auth/admin/users, etc.)
app.include_router(admin.router)

# Internal Service-to-Service Routes (/auth/internal/user-by-email, etc.)
# These routes are called by other microservices and do not require JWT.
app.include_router(internal.router, prefix="/auth/internal")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth-service"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=False)
