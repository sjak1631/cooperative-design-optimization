"""Admin-only endpoints for user management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.security import hash_password
from app.db.database import get_db
from app.db.models import Participant
from app.schemas.admin import (
    AssignTaskRequest,
    ChangePasswordRequest,
    CreateUserRequest,
    UserInfo,
)
from app.tasks.loader import load_tasks

router = APIRouter(prefix="/admin", tags=["admin"])


def _to_info(p: Participant) -> UserInfo:
    return UserInfo(
        id=p.id,
        participant_id=p.participant_id,
        is_admin=p.is_admin,
        task_no_badge=p.task_no_badge,
        task_badge=p.task_badge,
        created_at=p.created_at,
    )


@router.get("/users", response_model=list[UserInfo])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: Participant = Depends(require_admin),
) -> list[UserInfo]:
    result = await db.execute(select(Participant).order_by(Participant.id))
    return [_to_info(p) for p in result.scalars().all()]


@router.post("/users", response_model=UserInfo, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _: Participant = Depends(require_admin),
) -> UserInfo:
    result = await db.execute(
        select(Participant).where(Participant.participant_id == req.participant_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="participant_id already exists")

    participant = Participant(
        participant_id=req.participant_id,
        password_hash=hash_password(req.password),
        is_admin=req.is_admin,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)
    return _to_info(participant)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: Participant = Depends(require_admin),
) -> None:
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.execute(select(Participant).where(Participant.id == user_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(participant)
    await db.commit()


@router.patch("/users/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    user_id: int,
    req: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    _: Participant = Depends(require_admin),
) -> None:
    result = await db.execute(select(Participant).where(Participant.id == user_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="User not found")
    participant.password_hash = hash_password(req.new_password)
    await db.commit()


@router.patch("/users/{user_id}/assignment", response_model=UserInfo)
async def assign_task(
    user_id: int,
    req: AssignTaskRequest,
    db: AsyncSession = Depends(get_db),
    _: Participant = Depends(require_admin),
) -> UserInfo:
    result = await db.execute(select(Participant).where(Participant.id == user_id))
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=404, detail="User not found")

    if req.task_no_badge is not None or req.task_badge is not None:
        tasks = load_tasks()
        if req.task_no_badge is not None and req.task_no_badge not in tasks:
            raise HTTPException(status_code=400, detail=f"Unknown task_id: {req.task_no_badge}")
        if req.task_badge is not None and req.task_badge not in tasks:
            raise HTTPException(status_code=400, detail=f"Unknown task_id: {req.task_badge}")

    # Update only provided fields; explicit None clears the assignment
    if 'task_no_badge' in req.model_fields_set or req.task_no_badge is None:
        participant.task_no_badge = req.task_no_badge
    if 'task_badge' in req.model_fields_set or req.task_badge is None:
        participant.task_badge = req.task_badge

    await db.commit()
    await db.refresh(participant)
    return _to_info(participant)
