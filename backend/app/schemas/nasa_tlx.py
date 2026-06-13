from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class PairwiseChoice(BaseModel):
    pair: list[str] = Field(..., min_length=2, max_length=2)
    chosen: str


class NASATLXRequest(BaseModel):
    session_id: int
    mental_demand: int = Field(..., ge=0, le=100)
    physical_demand: int = Field(..., ge=0, le=100)
    temporal_demand: int = Field(..., ge=0, le=100)
    performance: int = Field(..., ge=0, le=100)
    effort: int = Field(..., ge=0, le=100)
    frustration: int = Field(..., ge=0, le=100)
    pairwise_choices: list[PairwiseChoice] = Field(..., min_length=15, max_length=15)


class NASATLXResult(BaseModel):
    id: int
    session_id: int
    mental_demand: int
    physical_demand: int
    temporal_demand: int
    performance: int
    effort: int
    frustration: int
    pairwise_choices: list[Any]
    weights: dict[str, Any]
    weighted_tlx: float
    created_at: datetime

    model_config = {"from_attributes": True}
