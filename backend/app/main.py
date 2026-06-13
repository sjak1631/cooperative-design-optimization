from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import get_settings
from app.db.database import AsyncSessionLocal, init_db
from app.db.models import EndReason, StudySession
from app.api.routes import auth, session, evaluate, bo, tasks, admin, nasa_tlx, mtq

settings = get_settings()

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,     prefix="/api")
app.include_router(session.router,  prefix="/api")
app.include_router(evaluate.router, prefix="/api")
app.include_router(bo.router,       prefix="/api")
app.include_router(tasks.router,    prefix="/api")
app.include_router(admin.router,    prefix="/api")
app.include_router(nasa_tlx.router, prefix="/api")
app.include_router(mtq.router,      prefix="/api")


@app.on_event("startup")
async def startup() -> None:
    await init_db()


@app.on_event("shutdown")
async def shutdown() -> None:
    """Mark all active sessions as ended when the server shuts down."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StudySession).where(StudySession.is_active == True)  # noqa: E712
        )
        active_sessions = result.scalars().all()
        for s in active_sessions:
            s.is_active = False
            s.ended_at = datetime.now(timezone.utc)
            s.end_reason = EndReason.server_shutdown
        if active_sessions:
            await db.commit()


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": settings.APP_VERSION}
