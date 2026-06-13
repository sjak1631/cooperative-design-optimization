import enum
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Condition(str, enum.Enum):
    badge = "badge"
    no_badge = "no_badge"


class EvalType(str, enum.Enum):
    informal = "informal"
    formal = "formal"


class EndReason(str, enum.Enum):
    pareto = "pareto"
    timeout = "timeout"
    manual = "manual"
    server_shutdown = "server_shutdown"


# ── Participant ──────────────────────────────────────────────────────────────
class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")
    is_guest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="0")
    task_no_badge: Mapped[str | None] = mapped_column(String(64), nullable=True)  # web app assigned to no_badge condition
    task_badge: Mapped[str | None] = mapped_column(String(64), nullable=True)     # web app assigned to badge condition
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sessions: Mapped[list["StudySession"]] = relationship(back_populates="participant")


# ── StudySession ─────────────────────────────────────────────────────────────
class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id"), nullable=False)
    condition: Mapped[Condition] = mapped_column(Enum(Condition), nullable=False)
    task_id: Mapped[str] = mapped_column(String(64), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=1)  # 1st or 2nd condition
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_reason: Mapped[EndReason | None] = mapped_column(Enum(EndReason), nullable=True)

    participant: Mapped["Participant"] = relationship(back_populates="sessions")
    evaluations: Mapped[list["Evaluation"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    bo_state: Mapped["BOState | None"] = relationship(back_populates="session", uselist=False, cascade="all, delete-orphan")


# ── Evaluation ───────────────────────────────────────────────────────────────
class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("study_sessions.id"), nullable=False)
    eval_type: Mapped[EvalType] = mapped_column(Enum(EvalType), nullable=False)
    parameters: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    speed: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, nullable=False)
    noise_var: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["StudySession"] = relationship(back_populates="evaluations")


# ── ChatMessage ───────────────────────────────────────────────────────────────
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("study_sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user / assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    selected_candidate_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["StudySession"] = relationship(back_populates="chat_messages")


# ── BOState ───────────────────────────────────────────────────────────────────
class BOState(Base):
    """Persists BoTorch training data for session resume."""

    __tablename__ = "bo_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("study_sessions.id"), unique=True, nullable=False)
    train_X: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)   # [[x0..x4], ...]
    train_Y: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list)   # [[speed, acc], ...]
    noise_vars: Mapped[list[Any]] = mapped_column(JSON, nullable=False, default=list) # [[var_s, var_a], ...]
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    session: Mapped["StudySession"] = relationship(back_populates="bo_state")


# ── NASATLXResponse ──────────────────────────────────────────────────────────
class NASATLXResponse(Base):
    __tablename__ = "nasa_tlx_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("study_sessions.id"), unique=True, nullable=False)
    # Raw ratings (0-100)
    mental_demand: Mapped[int] = mapped_column(Integer, nullable=False)
    physical_demand: Mapped[int] = mapped_column(Integer, nullable=False)
    temporal_demand: Mapped[int] = mapped_column(Integer, nullable=False)
    performance: Mapped[int] = mapped_column(Integer, nullable=False)
    effort: Mapped[int] = mapped_column(Integer, nullable=False)
    frustration: Mapped[int] = mapped_column(Integer, nullable=False)
    # Pairwise comparison choices (list of 15 dicts: {pair: [dim_a, dim_b], chosen: dim})
    pairwise_choices: Mapped[list[Any]] = mapped_column(JSON, nullable=False)
    # Weight counts per dimension (how many times each was chosen out of 15)
    weights: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    # Final weighted TLX score
    weighted_tlx: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["StudySession"] = relationship()


# ── MTQResponse ───────────────────────────────────────────────────────────────
class MTQResponse(Base):
    __tablename__ = "mtq_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("study_sessions.id"), unique=True, nullable=False)
    # Raw Likert responses (1–4 scale)
    purpose_q1: Mapped[int] = mapped_column(Integer, nullable=False)
    purpose_q2: Mapped[int] = mapped_column(Integer, nullable=False)
    purpose_q3: Mapped[int] = mapped_column(Integer, nullable=False)
    transparency_q1: Mapped[int] = mapped_column(Integer, nullable=False)
    transparency_q2: Mapped[int] = mapped_column(Integer, nullable=False)
    transparency_q3: Mapped[int] = mapped_column(Integer, nullable=False)
    utility_q1: Mapped[int] = mapped_column(Integer, nullable=False)  # stored as raw; reversed in scoring
    utility_q2: Mapped[int] = mapped_column(Integer, nullable=False)
    utility_q3: Mapped[int] = mapped_column(Integer, nullable=False)
    # Computed dimension scores (mean of 3 items; utility_q1 reversed as 5 - q1)
    purpose_score: Mapped[float] = mapped_column(Float, nullable=False)
    transparency_score: Mapped[float] = mapped_column(Float, nullable=False)
    utility_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped["StudySession"] = relationship()
