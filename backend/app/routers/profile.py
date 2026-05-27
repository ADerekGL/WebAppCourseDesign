from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import require_roles
from ..models import EventLog, EventType, Role, User, UserAddress, UserCoupon, WishlistItem

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("")
def get_profile(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> dict:
    customer = (
        db.query(User)
        .options(joinedload(User.addresses), joinedload(User.orders), joinedload(User.coupons).joinedload(UserCoupon.coupon))
        .filter(User.id == user.id)
        .first()
    )
    return {
        "id": customer.id,
        "username": customer.username,
        "email": customer.email,
        "phone": customer.phone,
        "city": customer.city,
        "province": customer.province,
        "membership_tier": customer.membership_tier.value,
        "birth_date": customer.birth_date.isoformat() if customer.birth_date else None,
        "preferred_categories": customer.preferred_categories_json or [],
        "addresses": [
            {
                "id": address.id,
                "contact_name": address.contact_name,
                "phone": address.phone,
                "province": address.province,
                "city": address.city,
                "district": address.district,
                "address_line": address.address_line,
                "postal_code": address.postal_code,
                "is_default": address.is_default,
            }
            for address in customer.addresses
        ],
        "coupons": [
            {
                "id": record.id,
                "code": record.coupon.code,
                "name": record.coupon.name,
                "discount_type": record.coupon.discount_type,
                "discount_value": record.coupon.discount_value,
                "minimum_spend": record.coupon.minimum_spend,
                "expires_at": record.coupon.expires_at.isoformat() if record.coupon.expires_at else None,
                "is_used": record.is_used,
                "used_at": record.used_at.isoformat() if record.used_at else None,
            }
            for record in customer.coupons
        ],
        "summary": {
            "order_count": len(customer.orders),
            "total_spent": round(sum(order.total_amount for order in customer.orders), 2),
        },
    }


@router.post("/addresses")
def create_address(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> dict:
    address = UserAddress(
        user_id=user.id,
        contact_name=payload.get("contact_name", user.username),
        phone=payload.get("phone", user.phone or ""),
        province=payload.get("province", user.province or ""),
        city=payload.get("city", user.city or ""),
        district=payload.get("district", ""),
        address_line=payload.get("address_line", ""),
        postal_code=payload.get("postal_code", ""),
        is_default=bool(payload.get("is_default", False)),
    )
    if address.is_default:
        db.query(UserAddress).filter(UserAddress.user_id == user.id).update({"is_default": False})
    db.add(address)
    db.commit()
    db.refresh(address)
    return {"id": address.id, "message": "Address created"}


@router.patch("/addresses/{address_id}")
def update_address(
    address_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> dict:
    address = db.query(UserAddress).filter(UserAddress.id == address_id, UserAddress.user_id == user.id).first()
    if not address:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    if payload.get("is_default"):
        db.query(UserAddress).filter(UserAddress.user_id == user.id).update({"is_default": False})
    for field in ["contact_name", "phone", "province", "city", "district", "address_line", "postal_code", "is_default"]:
        if field in payload:
            setattr(address, field, payload[field])
    db.commit()
    return {"message": "Address updated"}


@router.delete("/addresses/{address_id}")
def delete_address(
    address_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> dict:
    address = db.query(UserAddress).filter(UserAddress.id == address_id, UserAddress.user_id == user.id).first()
    if not address:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found")
    db.delete(address)
    db.commit()
    return {"message": "Address deleted"}


@router.get("/browsing-history")
def browsing_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> list[dict]:
    records = (
        db.query(EventLog)
        .filter(EventLog.user_id == user.id, EventLog.event_type == EventType.BROWSE)
        .order_by(EventLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": record.id,
            "content": record.content,
            "category_name": record.category_name,
            "created_at": record.created_at.isoformat(),
            "product_id": (record.metadata_json or {}).get("product_id"),
            "dwell_seconds": record.dwell_seconds,
        }
        for record in records
    ]


@router.get("/wishlist")
def wishlist(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> list[dict]:
    items = (
        db.query(WishlistItem)
        .options(joinedload(WishlistItem.product))
        .filter(WishlistItem.user_id == user.id)
        .order_by(WishlistItem.created_at.desc())
        .all()
    )
    return [
        {
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name,
            "price": item.product.price,
            "price_drop_alert": item.price_drop_alert,
            "created_at": item.created_at.isoformat(),
        }
        for item in items
    ]
