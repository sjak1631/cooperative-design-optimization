from __future__ import annotations
from pydantic import BaseModel


class CandidatePoint(BaseModel):
    index: int
    parameters: dict[str, float]
    mean_speed: float
    variance_speed: float
    mean_accuracy: float
    variance_accuracy: float
    acquisition_value: float
    confidence_badge: str | None = None  # "High" | "Medium" | "Low" | None


class BOSuggestRequest(BaseModel):
    session_id: int


class BOSuggestResponse(BaseModel):
    candidates: list[CandidatePoint]
    has_model: bool  # False if not enough data yet (returns random)


class LLMSelectRequest(BaseModel):
    session_id: int
    user_message: str
    candidates: list[CandidatePoint]


class LLMSelectResponse(BaseModel):
    selected_index: int
    selected_parameters: dict[str, float]
    assistant_message: str
    user_message_saved_id: int
    assistant_message_saved_id: int


class ChatHistoryItem(BaseModel):
    id: int
    role: str
    content: str
    selected_candidate_index: int | None

    model_config = {"from_attributes": True}
