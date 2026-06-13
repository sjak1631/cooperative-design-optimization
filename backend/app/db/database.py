from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # SQLite migrations: add new columns if they don't exist yet
        from sqlalchemy import text
        for stmt in [
            "ALTER TABLE participants ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE participants ADD COLUMN assigned_task_id VARCHAR(64)",
            "ALTER TABLE participants ADD COLUMN assigned_condition VARCHAR(16)",
            "ALTER TABLE participants ADD COLUMN task_no_badge VARCHAR(64)",
            "ALTER TABLE participants ADD COLUMN task_badge VARCHAR(64)",
            "ALTER TABLE participants ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT 0",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # column already exists
