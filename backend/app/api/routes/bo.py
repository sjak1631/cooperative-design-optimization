"""BO suggest + LLM select endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_participant
from app.bo.optimizer import assign_confidence_badges, suggest_batch
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import BOState, ChatMessage, Condition, EvalType, Evaluation, Participant, StudySession
from app.llm.selector import select_candidate
from app.schemas.bo import (
    BOSuggestRequest, BOSuggestResponse, CandidatePoint,
    ChatHistoryItem, LLMSelectRequest, LLMSelectResponse,
)
from app.tasks.loader import get_task

router = APIRouter(prefix="/bo", tags=["bo"])
settings = get_settings()


@router.post("/suggest", response_model=BOSuggestResponse)
async def bo_suggest(
    req: BOSuggestRequest,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> BOSuggestResponse:
    result = await db.execute(
        select(StudySession).where(
            StudySession.id == req.session_id,
            StudySession.participant_id == participant.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check minimum formal evaluations before allowing LLM
    formal_count_result = await db.execute(
        select(Evaluation).where(
            Evaluation.session_id == session.id,
            Evaluation.eval_type == EvalType.formal,
        )
    )
    formal_count = len(formal_count_result.scalars().all())
    if formal_count < settings.LLM_MIN_FORMAL_EVALS:
        raise HTTPException(
            status_code=403,
            detail=f"LLM is locked until {settings.LLM_MIN_FORMAL_EVALS} formal evaluations are completed ({formal_count}/{settings.LLM_MIN_FORMAL_EVALS} done)",
        )

    task = get_task(session.task_id)
    with_badge = session.condition == Condition.badge

    bo_result = await db.execute(select(BOState).where(BOState.session_id == session.id))
    bo_state = bo_result.scalar_one_or_none()

    train_X    = bo_state.train_X    if bo_state else []
    train_Y    = bo_state.train_Y    if bo_state else []
    noise_vars = bo_state.noise_vars if bo_state else []

    has_model = len(train_X) >= 3

    raw_candidates = suggest_batch(
        task=task,
        train_X_raw=train_X,
        train_Y_raw=train_Y,
        noise_vars_raw=noise_vars,
        batch_size=settings.BO_BATCH_SIZE,
    )

    badges: list[str | None]
    if with_badge:
        badges = assign_confidence_badges(raw_candidates, train_Y)
    else:
        badges = [None] * len(raw_candidates)

    candidates = [
        CandidatePoint(
            index=i,
            parameters=c["parameters"],
            mean_speed=c["mean_speed"],
            variance_speed=c["variance_speed"],
            mean_accuracy=c["mean_accuracy"],
            variance_accuracy=c["variance_accuracy"],
            acquisition_value=c["acquisition_value"],
            confidence_badge=badges[i],
        )
        for i, c in enumerate(raw_candidates)
    ]

    return BOSuggestResponse(candidates=candidates, has_model=has_model)


@router.post("/select", response_model=LLMSelectResponse)
async def llm_select(
    req: LLMSelectRequest,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> LLMSelectResponse:
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

    # Check minimum formal evaluations before allowing LLM
    formal_count_result = await db.execute(
        select(Evaluation).where(
            Evaluation.session_id == session.id,
            Evaluation.eval_type == EvalType.formal,
        )
    )
    formal_count = len(formal_count_result.scalars().all())
    if formal_count < settings.LLM_MIN_FORMAL_EVALS:
        raise HTTPException(
            status_code=403,
            detail=f"LLM is locked until {settings.LLM_MIN_FORMAL_EVALS} formal evaluations are completed ({formal_count}/{settings.LLM_MIN_FORMAL_EVALS} done)",
        )

    task = get_task(session.task_id)
    with_badge = session.condition == Condition.badge

    # Build history for LLM context
    eval_result = await db.execute(
        select(Evaluation)
        .where(Evaluation.session_id == session.id)
        .order_by(Evaluation.created_at)
    )
    history = [
        {
            "parameters": e.parameters,
            "speed": e.speed,
            "accuracy": e.accuracy,
            "eval_type": e.eval_type.value,
        }
        for e in eval_result.scalars().all()
    ]

    selected_index, assistant_message = await select_candidate(
        task=task,
        user_message=req.user_message,
        candidates=req.candidates,
        history=history,
        with_badge=with_badge,
    )

    # Save chat messages
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=req.user_message,
    )
    db.add(user_msg)
    await db.flush()

    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=assistant_message,
        selected_candidate_index=selected_index,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    selected_params = req.candidates[selected_index].parameters

    return LLMSelectResponse(
        selected_index=selected_index,
        selected_parameters=selected_params,
        assistant_message=assistant_message,
        user_message_saved_id=user_msg.id,
        assistant_message_saved_id=assistant_msg.id,
    )


@router.get("/chat/{session_id}", response_model=list[ChatHistoryItem])
async def get_chat_history(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> list[ChatHistoryItem]:
    result = await db.execute(
        select(StudySession).where(
            StudySession.id == session_id,
            StudySession.participant_id == participant.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    return [
        ChatHistoryItem(
            id=m.id,
            role=m.role,
            content=m.content,
            selected_candidate_index=m.selected_candidate_index,
        )
        for m in msg_result.scalars().all()
    ]
