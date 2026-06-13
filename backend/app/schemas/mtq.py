from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field


class MTQRequest(BaseModel):
    session_id: int
    # Purpose dimension (1–4 Likert)
    purpose_q1: int = Field(..., ge=1, le=4)
    purpose_q2: int = Field(..., ge=1, le=4)
    purpose_q3: int = Field(..., ge=1, le=4)
    # Transparency dimension (1–4 Likert)
    transparency_q1: int = Field(..., ge=1, le=4)
    transparency_q2: int = Field(..., ge=1, le=4)
    transparency_q3: int = Field(..., ge=1, le=4)
    # Utility dimension (1–4 Likert; q1 is reversed item)
    utility_q1: int = Field(..., ge=1, le=4)
    utility_q2: int = Field(..., ge=1, le=4)
    utility_q3: int = Field(..., ge=1, le=4)


class MTQResult(BaseModel):
    id: int
    session_id: int
    purpose_q1: int
    purpose_q2: int
    purpose_q3: int
    transparency_q1: int
    transparency_q2: int
    transparency_q3: int
    utility_q1: int
    utility_q2: int
    utility_q3: int
    purpose_score: float
    transparency_score: float
    utility_score: float
    created_at: datetime

    model_config = {"from_attributes": True}
