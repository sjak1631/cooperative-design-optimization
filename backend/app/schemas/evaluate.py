from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel
from app.db.models import EvalType


class EvaluateRequest(BaseModel):
    session_id: int
    eval_type: EvalType
    parameters: dict[str, float]


class EvaluationResult(BaseModel):
    evaluation_id: int
    eval_type: EvalType
    speed: float
    accuracy: float
    parameters: dict[str, float]
    created_at: datetime
    session_ended: bool = False
    end_reason: str | None = None
    pareto_front_count: int = 0

    model_config = {"from_attributes": True}


class EvaluationHistoryItem(BaseModel):
    evaluation_id: int
    eval_type: EvalType
    speed: float
    accuracy: float
    parameters: dict[str, float]
    created_at: datetime
    is_latent: bool  # True = most recent

    model_config = {"from_attributes": True}
