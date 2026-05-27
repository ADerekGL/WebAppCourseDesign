from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import EventType, Role, User
from ..schemas import LoginRequest, PasswordResetRequest, Token, UserCreate, UserRead
from ..security import create_access_token, hash_password, verify_password
from ..services.event_logger import log_event

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)) -> User:
    if db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=Role.CUSTOMER,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_event(db, request, EventType.OPERATION, user=user, content="Customer self-registration")
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.last_login_at = datetime.utcnow()
    db.commit()
    token = create_access_token(user.username)
    log_event(db, request, EventType.LOGIN, user=user, content=f"{user.role.value} login")
    return Token(access_token=token, user=user)


@router.post("/password-reset")
def password_reset(payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        user.password_hash = hash_password("password")
        db.commit()
        log_event(db, request, EventType.OPERATION, user=user, content="Password reset to default test password")
    return {"message": "If the account exists, a reset action has been processed."}
