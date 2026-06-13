from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserInfo(BaseModel):
    id: int
    participant_id: str
    is_admin: bool
    is_guest: bool = False
    task_no_badge: Optional[str] = None   # web app id assigned to no_badge condition
    task_badge: Optional[str] = None      # web app id assigned to badge condition
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateUserRequest(BaseModel):
    participant_id: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=6)
    is_admin: bool = False


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6)


class AssignTaskRequest(BaseModel):
    task_no_badge: Optional[str] = None   # web app id for no_badge condition (None to clear)
    task_badge: Optional[str] = None      # web app id for badge condition (None to clear)
