from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_roles
from ..models import EventLog, EventType, Product, Role, User
from ..schemas import SalesAccountCreate, SalesAccountPasswordReset, UserRead
from ..security import hash_password
from ..services.event_logger import log_event

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/sales-accounts", response_model=list[UserRead])
def list_sales_accounts(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
) -> list[User]:
    return db.query(User).filter(User.role == Role.SALES).all()


@router.post("/sales-accounts", response_model=UserRead)
def create_sales_account(
    payload: SalesAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
) -> User:
    account = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_verified=True,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    log_event(db, request, event_type=EventType.OPERATION, user=user, content=f"Created sales account {account.username}")
    return account


@router.post("/sales-accounts/{user_id}/reset-password")
def reset_sales_password(
    user_id: int,
    payload: SalesAccountPasswordReset,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    account = db.query(User).filter(User.id == user_id, User.role == Role.SALES).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales account not found")
    account.password_hash = hash_password(payload.new_password)
    db.commit()
    log_event(db, request, event_type=EventType.OPERATION, user=user, content=f"Reset password for {account.username}")
    return {"message": "Password reset completed"}


@router.delete("/sales-accounts/{user_id}")
def delete_sales_account(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    account = db.query(User).filter(User.id == user_id, User.role == Role.SALES).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales account not found")
    username = account.username
    db.delete(account)
    db.commit()
    log_event(db, request, event_type=EventType.OPERATION, user=user, content=f"Deleted sales account {username}")
    return {"message": "Sales account deleted"}


@router.get("/performance")
def sales_performance(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    staff = db.query(User).filter(User.role == Role.SALES).all()
    inventory_low = db.query(Product).filter(Product.stock_quantity < 10).count()
    operation_count = db.query(EventLog).count()
    return {
        "sales_staff_count": len(staff),
        "low_inventory_products": inventory_low,
        "logged_events": operation_count,
    }
