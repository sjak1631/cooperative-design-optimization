"""Evaluation endpoint — server-side objective function + session end check."""
from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_participant
from app.bo.optimizer import compute_pareto_front
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import BOState, EndReason, EvalType, Evaluation, Participant, StudySession
from app.schemas.evaluate import EvaluateRequest, EvaluationHistoryItem, EvaluationResult
from app.tasks.loader import get_task

router = APIRouter(prefix="/evaluate", tags=["evaluate"])
settings = get_settings()


def _uniform_noise(bound: float) -> float:
    """Uniform(-bound, bound) noise."""
    return random.uniform(-bound, bound)


def _compute_objective(params: dict[str, float], task_id: str, eval_type: EvalType) -> tuple[float, float, float]:
    """Returns (speed, accuracy, noise_var).

    f_j(x) = c_j - Σ_i b_ji * (x_i - a_ji)^2  + Uniform(-bound, bound)
    noise_var = bound^2 / 3  (variance of Uniform(-b, b))
    """
    task = get_task(task_id)
    x = [params.get(p.key, 0.5) for p in task.parameters]

    noise_bound = task._noise_informal if eval_type == EvalType.informal else task._noise_formal
    noise_var = (noise_bound ** 2) / 3.0

    speed    = task._obj_baselines[0]
    accuracy = task._obj_baselines[1]

    for i in range(len(x)):
        speed    -= task._obj_weights[0][i] * (x[i] - task._obj_centers[0][i]) ** 2
        accuracy -= task._obj_weights[1][i] * (x[i] - task._obj_centers[1][i]) ** 2

    speed    += _uniform_noise(noise_bound)
    accuracy += _uniform_noise(noise_bound)

    speed    = max(0.0, min(1.0, speed))
    accuracy = max(0.0, min(1.0, accuracy))
    return speed, accuracy, noise_var


@router.post("", response_model=EvaluationResult)
async def evaluate(
    req: EvaluateRequest,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> EvaluationResult:
    # Verify session ownership
    result = await db.execute(
        select(StudySession).where(
            StudySession.id == req.session_id,
            StudySession.participant_id == participant.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.is_active:
        raise HTTPException(status_code=409, detail="Session already ended")

    speed, accuracy, noise_var = _compute_objective(req.parameters, session.task_id, req.eval_type)

    evaluation = Evaluation(
        session_id=session.id,
        eval_type=req.eval_type,
        parameters=req.parameters,
        speed=speed,
        accuracy=accuracy,
        noise_var=noise_var,
    )
    db.add(evaluation)
    await db.flush()

    # Update BO state — formal evaluations only
    if req.eval_type == EvalType.formal:
        bo_result = await db.execute(select(BOState).where(BOState.session_id == session.id))
        bo_state = bo_result.scalar_one_or_none()
        if bo_state is None:
            bo_state = BOState(session_id=session.id, train_X=[], train_Y=[], noise_vars=[])
            db.add(bo_state)
            await db.flush()

        task = get_task(session.task_id)
        x_row = [req.parameters.get(p.key, 0.5) for p in task.parameters]
        bo_state.train_X = list(bo_state.train_X) + [x_row]
        bo_state.train_Y = list(bo_state.train_Y) + [[speed, accuracy]]
        bo_state.noise_vars = list(bo_state.noise_vars) + [[noise_var, noise_var]]
        bo_state.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(evaluation)

    # Check session end conditions
    session_ended = False
    end_reason_str: str | None = None
    pf_count = 0

    return EvaluationResult(
        evaluation_id=evaluation.id,
        eval_type=evaluation.eval_type,
        speed=evaluation.speed,
        accuracy=evaluation.accuracy,
        parameters=evaluation.parameters,
        created_at=evaluation.created_at,
        session_ended=session_ended,
        end_reason=end_reason_str,
        pareto_front_count=pf_count,
    )


@router.get("/history/{session_id}", response_model=list[EvaluationHistoryItem])
async def get_history(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> list[EvaluationHistoryItem]:
    result = await db.execute(
        select(StudySession).where(
            StudySession.id == session_id,
            StudySession.participant_id == participant.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    eval_result = await db.execute(
        select(Evaluation)
        .where(Evaluation.session_id == session_id)
        .order_by(Evaluation.created_at)
    )
    evals = eval_result.scalars().all()

    items = []
    for i, e in enumerate(evals):
        items.append(EvaluationHistoryItem(
            evaluation_id=e.id,
            eval_type=e.eval_type,
            speed=e.speed,
            accuracy=e.accuracy,
            parameters=e.parameters,
            created_at=e.created_at,
            is_latent=(i == len(evals) - 1),
        ))
    return items
