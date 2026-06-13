"""Auth endpoints: register (admin-only), login, guest login, and me."""
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import Participant
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.admin import UserInfo
from app.api.deps import get_current_participant

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    if req.admin_secret != settings.SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin secret")

    result = await db.execute(select(Participant).where(Participant.participant_id == req.participant_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="participant_id already exists")

    # First user named "admin" is automatically an admin
    is_admin = req.participant_id == "admin"
    participant = Participant(
        participant_id=req.participant_id,
        password_hash=hash_password(req.password),
        is_admin=is_admin,
    )
    db.add(participant)
    await db.commit()

    token = create_access_token(subject=req.participant_id)
    return TokenResponse(access_token=token, participant_id=req.participant_id, is_admin=is_admin)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(Participant).where(Participant.participant_id == req.participant_id))
    participant = result.scalar_one_or_none()

    if not participant or not verify_password(req.password, participant.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid participant_id or password",
        )

    token = create_access_token(subject=participant.participant_id)
    return TokenResponse(
        access_token=token,
        participant_id=participant.participant_id,
        is_admin=participant.is_admin,
    )


@router.post("/guest", response_model=TokenResponse)
async def guest_login(db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Create a throwaway guest participant and return a JWT.

    Each call creates a new unique guest account so simultaneous guests
    never share a session.  Guest login must be enabled via
    GUEST_LOGIN_ENABLED=true in the environment.
    """
    if not settings.GUEST_LOGIN_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest login is not enabled",
        )

    # Unique guest ID — short UUID hex suffix prevents collisions
    guest_id = f"guest_{uuid.uuid4().hex[:12]}"

    # Unmatchable random password (guest account can never be password-logged-in)
    dummy_pw = secrets.token_hex(32)

    participant = Participant(
        participant_id=guest_id,
        password_hash=hash_password(dummy_pw),
        is_admin=False,
        is_guest=True,
        task_badge=settings.GUEST_TASK_ID,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)

    token = create_access_token(subject=guest_id)
    return TokenResponse(
        access_token=token,
        participant_id=guest_id,
        is_admin=False,
        is_guest=True,
    )


@router.get("/me", response_model=UserInfo)
async def get_me(
    participant: Participant = Depends(get_current_participant),
) -> UserInfo:
    from app.schemas.admin import UserInfo as UI
    return UI(
        id=participant.id,
        participant_id=participant.participant_id,
        is_admin=participant.is_admin,
        is_guest=participant.is_guest,
        task_no_badge=participant.task_no_badge,
        task_badge=participant.task_badge,
        created_at=participant.created_at,
    )
