"""MTQ (Multidimensional Trust Questionnaire) survey endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_participant
from app.db.database import get_db
from app.db.models import MTQResponse, Participant, StudySession
from app.schemas.mtq import MTQRequest, MTQResult

router = APIRouter(prefix="/mtq", tags=["mtq"])


def _compute_scores(req: MTQRequest) -> tuple[float, float, float]:
    """Compute dimension means. utility_q1 is a reversed item (5 - raw)."""
    purpose = (req.purpose_q1 + req.purpose_q2 + req.purpose_q3) / 3.0
    transparency = (req.transparency_q1 + req.transparency_q2 + req.transparency_q3) / 3.0
    utility_q1_scored = 5 - req.utility_q1  # reversed item
    utility = (utility_q1_scored + req.utility_q2 + req.utility_q3) / 3.0
    return purpose, transparency, utility


@router.post("", response_model=MTQResult)
async def submit_mtq(
    req: MTQRequest,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> MTQResult:
    # Verify session belongs to this participant
    result = await db.execute(
        select(StudySession).where(
            StudySession.id == req.session_id,
            StudySession.participant_id == participant.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Prevent duplicate submission
    existing = await db.execute(
        select(MTQResponse).where(MTQResponse.session_id == req.session_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="MTQ already submitted for this session")

    purpose_score, transparency_score, utility_score = _compute_scores(req)

    record = MTQResponse(
        session_id=req.session_id,
        purpose_q1=req.purpose_q1,
        purpose_q2=req.purpose_q2,
        purpose_q3=req.purpose_q3,
        transparency_q1=req.transparency_q1,
        transparency_q2=req.transparency_q2,
        transparency_q3=req.transparency_q3,
        utility_q1=req.utility_q1,
        utility_q2=req.utility_q2,
        utility_q3=req.utility_q3,
        purpose_score=purpose_score,
        transparency_score=transparency_score,
        utility_score=utility_score,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return MTQResult.model_validate(record)


@router.get("/{session_id}", response_model=MTQResult)
async def get_mtq(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> MTQResult:
    result = await db.execute(
        select(MTQResponse).where(MTQResponse.session_id == session_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="MTQ response not found")
    return MTQResult.model_validate(record)
