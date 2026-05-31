from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel
from app.db.models import Condition, EndReason


class SessionStartRequest(BaseModel):
    task_id: str
    condition: Condition


class SessionInfo(BaseModel):
    session_id: int
    task_id: str
    condition: Condition
    order_index: int
    started_at: datetime
    ended_at: datetime | None
    end_reason: EndReason | None
    is_active: bool
    elapsed_seconds: float
    pareto_front_count: int
    formal_eval_count: int

    model_config = {"from_attributes": True}


class SessionEndResponse(BaseModel):
    session_id: int
    end_reason: EndReason
    pareto_front_count: int
    elapsed_seconds: float
