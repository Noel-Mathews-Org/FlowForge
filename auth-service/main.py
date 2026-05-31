from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routes import auth, internal
from routes.users import router as users_router
from services.redis_service import get_redis


@asynccontextmanager
async def lifespan(_: FastAPI):
    # init tables + bootstrap default accounts
    await init_db()
    redis = get_redis()
    try:
        await redis.ping()
    except Exception:
        pass  # Redis optional for startup
    try:
        yield
    finally:
        await redis.close()


app = FastAPI(title="FlowForge Auth Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public + authenticated auth routes
app.include_router(auth.router)

# User management routes (/users/...)
app.include_router(users_router)

# Internal service-to-service routes (/internal/...)
app.include_router(internal.router, prefix="/internal")


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=False)
