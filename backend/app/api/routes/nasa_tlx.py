"""NASA-TLX survey submission endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_participant
from app.db.database import get_db
from app.db.models import NASATLXResponse, Participant, StudySession
from app.schemas.nasa_tlx import NASATLXRequest, NASATLXResult

router = APIRouter(prefix="/nasa-tlx", tags=["nasa-tlx"])

_DIMS = ["MD", "PD", "TD", "P", "EF", "FR"]


def _compute_weighted_tlx(
    ratings: dict[str, int],
    pairwise_choices: list,
) -> tuple[dict[str, int], float]:
    """Compute weights (0-5) and weighted TLX (0-100)."""
    weights: dict[str, int] = {d: 0 for d in _DIMS}
    for choice in pairwise_choices:
        chosen = choice.chosen if hasattr(choice, "chosen") else choice["chosen"]
        if chosen in weights:
            weights[chosen] += 1

    weighted_tlx = sum(weights[d] * ratings[d] for d in _DIMS) / 15.0
    return weights, weighted_tlx


@router.post("", response_model=NASATLXResult)
async def submit_nasa_tlx(
    req: NASATLXRequest,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> NASATLXResult:
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
        select(NASATLXResponse).where(NASATLXResponse.session_id == req.session_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="NASA-TLX already submitted for this session")

    ratings = {
        "MD": req.mental_demand,
        "PD": req.physical_demand,
        "TD": req.temporal_demand,
        "P": req.performance,
        "EF": req.effort,
        "FR": req.frustration,
    }
    weights, weighted_tlx = _compute_weighted_tlx(ratings, req.pairwise_choices)

    record = NASATLXResponse(
        session_id=req.session_id,
        mental_demand=req.mental_demand,
        physical_demand=req.physical_demand,
        temporal_demand=req.temporal_demand,
        performance=req.performance,
        effort=req.effort,
        frustration=req.frustration,
        pairwise_choices=[c.model_dump() for c in req.pairwise_choices],
        weights=weights,
        weighted_tlx=weighted_tlx,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return NASATLXResult.model_validate(record)


@router.get("/{session_id}", response_model=NASATLXResult)
async def get_nasa_tlx(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    participant: Participant = Depends(get_current_participant),
) -> NASATLXResult:
    result = await db.execute(
        select(NASATLXResponse).where(NASATLXResponse.session_id == session_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="NASA-TLX response not found")
    return NASATLXResult.model_validate(record)
