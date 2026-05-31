"""Session management endpoints."""
from __future__ import annotations

import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_participant
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import BOState, Condition, EndReason, EvalType, Evaluation, StudySession, Participant
from app.bo.optimizer import compute_pareto_front
from app.schemas.session import SessionInfo, SessionStartRequest
from app.tasks.loader import get_task

router = APIRouter(prefix="/session", tags=["session"])
settings = get_settings()


def _elapsed(session: StudySession) -> float:
    end = session.ended_at or datetime.now(timezone.utc)
    started = session.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return (end - started).total_seconds()


async def _formal_evals(session_id: int, db: AsyncSession) -> list:
    result = await db.execute(
        select(Evaluation).where(
            Evaluation.session_id == session_id,
            Evaluation.eval_type == EvalType.formal,
        )
    )
    return result.scalars().all()


async def _pareto_count(session_id: int, db: AsyncSession) -> int:
    evals = await _formal_evals(session_id, db)
    if not evals:
        return 0
    Y = [[e.speed, e.accuracy] for e in evals]
    return len(compute_pareto_front(Y))


@router.post("/start", response_model=SessionInfo)
async def start_session(
    req: SessionStartRequest,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> SessionInfo:
    # Validate task
    try:
        task = get_task(req.task_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Non-admin users must use the correct task for their assigned condition
    # (fixed tasks are available to everyone without assignment check)
    if not participant.is_admin and not task.is_fixed:
        if req.condition == Condition.no_badge and participant.task_no_badge is not None:
            if req.task_id != participant.task_no_badge:
                raise HTTPException(
                    status_code=403,
                    detail=f"For no_badge condition you are assigned to '{participant.task_no_badge}', not '{req.task_id}'",
                )
        elif req.condition == Condition.badge and participant.task_badge is not None:
            if req.task_id != participant.task_badge:
                raise HTTPException(
                    status_code=403,
                    detail=f"For badge condition you are assigned to '{participant.task_badge}', not '{req.task_id}'",
                )

    # Deactivate any existing active session
    result = await db.execute(
        select(StudySession).where(
            StudySession.participant_id == participant.id,
            StudySession.is_active == True,
        )
    )
    for s in result.scalars().all():
        s.is_active = False
        s.ended_at = datetime.now(timezone.utc)
        s.end_reason = EndReason.manual

    # Count past sessions for order_index
    count_res = await db.execute(
        select(StudySession).where(StudySession.participant_id == participant.id)
    )
    order_index = len(count_res.scalars().all()) + 1

    session = StudySession(
        participant_id=participant.id,
        condition=req.condition,
        task_id=req.task_id,
        order_index=order_index,
    )
    db.add(session)
    await db.flush()

    # Initialize empty BO state
    bo_state = BOState(session_id=session.id, train_X=[], train_Y=[], noise_vars=[])
    db.add(bo_state)
    await db.commit()
    await db.refresh(session)

    return SessionInfo(
        session_id=session.id,
        task_id=session.task_id,
        condition=session.condition,
        order_index=session.order_index,
        started_at=session.started_at,
        ended_at=session.ended_at,
        end_reason=session.end_reason,
        is_active=session.is_active,
        elapsed_seconds=_elapsed(session),
        pareto_front_count=0,
        formal_eval_count=0,
    )


@router.get("/current", response_model=SessionInfo)
async def get_current_session(
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> SessionInfo:
    result = await db.execute(
        select(StudySession).where(
            StudySession.participant_id == participant.id,
            StudySession.is_active == True,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="No active session")

    formal_evals = await _formal_evals(session.id, db)
    pf_count = len(compute_pareto_front([[e.speed, e.accuracy] for e in formal_evals])) if formal_evals else 0
    elapsed = _elapsed(session)

    # Determine timeout for this task (task-specific override or global default)
    task_cfg = get_task(session.task_id)
    timeout_sec = (task_cfg.timeout_minutes or settings.SESSION_TIMEOUT_MINUTES) * 60

    # Auto-end if timeout
    if session.is_active and elapsed >= timeout_sec:
        session.is_active = False
        session.ended_at = datetime.now(timezone.utc)
        session.end_reason = EndReason.timeout
        await db.commit()

    return SessionInfo(
        session_id=session.id,
        task_id=session.task_id,
        condition=session.condition,
        order_index=session.order_index,
        started_at=session.started_at,
        ended_at=session.ended_at,
        end_reason=session.end_reason,
        is_active=session.is_active,
        elapsed_seconds=elapsed,
        pareto_front_count=pf_count,
        formal_eval_count=len(formal_evals),
    )


@router.post("/end", response_model=SessionInfo)
async def end_session(
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> SessionInfo:
    result = await db.execute(
        select(StudySession).where(
            StudySession.participant_id == participant.id,
            StudySession.is_active == True,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="No active session")

    session.is_active = False
    session.ended_at = datetime.now(timezone.utc)
    elapsed = _elapsed(session)
    task_cfg = get_task(session.task_id)
    timeout_sec = (task_cfg.timeout_minutes or settings.SESSION_TIMEOUT_MINUTES) * 60
    session.end_reason = (
        EndReason.timeout if elapsed >= timeout_sec
        else EndReason.manual
    )
    await db.commit()

    formal_evals = await _formal_evals(session.id, db)
    pf_count = len(compute_pareto_front([[e.speed, e.accuracy] for e in formal_evals])) if formal_evals else 0

    return SessionInfo(
        session_id=session.id,
        task_id=session.task_id,
        condition=session.condition,
        order_index=session.order_index,
        started_at=session.started_at,
        ended_at=session.ended_at,
        end_reason=session.end_reason,
        is_active=session.is_active,
        elapsed_seconds=_elapsed(session),
        pareto_front_count=pf_count,
        formal_eval_count=len(formal_evals),
    )


@router.get("/all", response_model=list[SessionInfo])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> list[SessionInfo]:
    result = await db.execute(
        select(StudySession).where(StudySession.participant_id == participant.id)
    )
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        fe = await _formal_evals(s.id, db)
        pf = len(compute_pareto_front([[e.speed, e.accuracy] for e in fe])) if fe else 0
        out.append(SessionInfo(
            session_id=s.id,
            task_id=s.task_id,
            condition=s.condition,
            order_index=s.order_index,
            started_at=s.started_at,
            ended_at=s.ended_at,
            end_reason=s.end_reason,
            is_active=s.is_active,
            elapsed_seconds=_elapsed(s),
            pareto_front_count=pf,
            formal_eval_count=len(fe),
        ))
    return out
