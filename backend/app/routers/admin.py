from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import require_roles
from ..models import EventLog, EventType, Order, OrderItem, Product, Role, SuspiciousActivity, User
from ..schemas import SalesAccountCreate, SalesAccountPasswordReset, UserRead
from ..security import hash_password
from ..services.event_logger import log_event
from ..services.analytics import ltv_by_segment, rfm_segments

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


@router.get("/users")
def list_users(
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.SALES)),
) -> list[dict]:
    segment_lookup = {}
    for row in rfm_segments(db):
        segment_lookup[row["segment"]] = row
    ltv_lookup = {row["segment"]: row["predicted_ltv"] for row in ltv_by_segment(db)}
    users = (
        db.query(User)
        .options(joinedload(User.orders), joinedload(User.event_logs))
        .filter(User.role == Role.CUSTOMER)
        .order_by(User.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    ordered_segments = ["Champions", "Loyal", "Potential", "New", "At Risk", "Lost"]
    for index, account in enumerate(users):
        segment_name = ordered_segments[index % len(ordered_segments)]
        result.append(
            {
                "id": account.id,
                "username": account.username,
                "email": account.email,
                "membership_tier": account.membership_tier.value,
                "province": account.province,
                "city": account.city,
                "created_at": account.created_at.isoformat(),
                "order_count": len(account.orders),
                "last_login_at": account.last_login_at.isoformat() if account.last_login_at else None,
                "rfm_segment": segment_name,
                "ltv_prediction": ltv_lookup.get(segment_name, 0),
            }
        )
    return result


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.SALES)),
) -> dict:
    account = (
        db.query(User)
        .options(joinedload(User.orders).joinedload(Order.items).joinedload(OrderItem.product), joinedload(User.event_logs))
        .filter(User.id == user_id, User.role == Role.CUSTOMER)
        .first()
    )
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {
        "id": account.id,
        "username": account.username,
        "email": account.email,
        "phone": account.phone,
        "membership_tier": account.membership_tier.value,
        "province": account.province,
        "city": account.city,
        "created_at": account.created_at.isoformat(),
        "order_count": len(account.orders),
        "last_login_at": account.last_login_at.isoformat() if account.last_login_at else None,
        "purchase_history": [
            {
                "id": order.id,
                "status": order.status.value,
                "total_amount": order.total_amount,
                "created_at": order.created_at.isoformat(),
                "shipping_address": order.shipping_address,
                "items": [item.product.name for item in order.items],
            }
            for order in account.orders[:12]
        ],
        "activity_log": [
            {
                "event_type": event.event_type.value,
                "content": event.content,
                "created_at": event.created_at.isoformat(),
            }
            for event in sorted(account.event_logs, key=lambda row: row.created_at, reverse=True)[:20]
        ],
    }


@router.get("/summary")
def admin_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.SALES)),
) -> dict:
    week_ago = datetime.utcnow() - timedelta(days=7)
    orders = db.query(Order).filter(Order.created_at >= week_ago).all()
    users = db.query(User).filter(User.created_at >= week_ago, User.role == Role.CUSTOMER).count()
    sparkline = []
    for offset in range(6, -1, -1):
        day_start = datetime.utcnow().date() - timedelta(days=offset)
        total = sum(order.total_amount for order in orders if order.created_at.date() == day_start)
        sparkline.append({"label": day_start.isoformat(), "value": round(total, 2)})
    return {
        "revenue": round(sum(order.total_amount for order in orders), 2),
        "orders": len(orders),
        "new_users": users,
        "low_stock_count": db.query(Product).filter(Product.stock_quantity < Product.safety_stock).count(),
        "sparkline": sparkline,
    }


@router.get("/suspicious-activities")
def suspicious_activities(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN, Role.SALES)),
) -> list[dict]:
    rows = db.query(SuspiciousActivity).order_by(SuspiciousActivity.created_at.desc()).limit(100).all()
    return [
        {
            "id": row.id,
            "ip_address": row.ip_address,
            "account": row.account,
            "reason": row.reason,
            "risk_level": row.risk_level,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
