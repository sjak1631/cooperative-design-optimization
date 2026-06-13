from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    participant_id: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    participant_id: str
    is_admin: bool = False
    is_guest: bool = False


class RegisterRequest(BaseModel):
    participant_id: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=6)
    admin_secret: str  # Prevent open registration
