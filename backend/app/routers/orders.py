from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import require_roles
from ..models import (
    Coupon,
    EventType,
    InventoryChangeType,
    InventoryLog,
    Order,
    OrderItem,
    OrderStatus,
    OrderTimeline,
    PaymentRecord,
    PaymentStatus,
    Product,
    ProductVariant,
    Role,
    ShippingTracking,
    User,
)
from ..schemas import CheckoutRequest, OrderItemRead, OrderRead, OrderTimelineRead, ShippingTrackingRead
from ..services.event_logger import log_event

router = APIRouter(prefix="/orders", tags=["orders"])


def serialize_order(order: Order) -> OrderRead:
    return OrderRead(
        id=order.id,
        status=order.status,
        total_amount=order.total_amount,
        shipping_address=order.shipping_address,
        created_at=order.created_at,
        coupon_code=order.coupon_code,
        payment_method=order.payment_method,
        items=[
            OrderItemRead(
                product_id=item.product_id,
                product_name=item.product.name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                variant_id=item.variant_id,
                image_url=item.product.image_url,
                thumbnail_url=item.product.thumbnail_url,
                category_name=item.product.category.name,
            )
            for item in order.items
        ],
        timeline=[
            OrderTimelineRead(
                status=entry.status,
                operator_account=entry.operator_account,
                note=entry.note,
                created_at=entry.created_at,
            )
            for entry in order.timeline
        ],
        shipping_updates=[
            ShippingTrackingRead(
                status_label=entry.status_label,
                location=entry.location,
                note=entry.note,
                created_at=entry.created_at,
            )
            for entry in order.shipping_updates
        ],
    )


@router.post("/checkout", response_model=OrderRead)
def checkout(
    payload: CheckoutRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> OrderRead:
    coupon = None
    if payload.coupon_code:
        coupon = db.query(Coupon).filter(Coupon.code == payload.coupon_code, Coupon.is_active.is_(True)).first()
        if not coupon:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon is invalid or inactive")

    order = Order(
        customer_id=user.id,
        shipping_address=payload.shipping_address,
        status=OrderStatus.PAID,
        payment_method=payload.payment_method,
        coupon_code=payload.coupon_code,
        delivery_fee=12.0,
    )
    db.add(order)
    total = 0.0

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.is_active.is_(True)).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")

        variant = None
        available_stock = product.stock_quantity
        if item.variant_id:
            variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id, ProductVariant.product_id == product.id).first()
            if not variant:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Variant {item.variant_id} not found")
            available_stock = variant.stock_quantity

        if available_stock < item.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for {product.name}")

        product.stock_quantity -= item.quantity
        if variant:
            variant.stock_quantity -= item.quantity

        order_item = OrderItem(
            product_id=product.id,
            variant_id=item.variant_id,
            quantity=item.quantity,
            unit_price=product.price,
        )
        order.items.append(order_item)
        total += product.price * item.quantity

        db.add(
            InventoryLog(
                product_id=product.id,
                change_type=InventoryChangeType.STOCK_OUT,
                quantity_delta=-item.quantity,
                stock_after=product.stock_quantity,
                supplier_name=product.supplier_name,
                note=f"Order #{order.id or 'pending'} checkout",
                operator_account=user.username,
            )
        )
        log_event(
            db,
            request,
            EventType.PURCHASE,
            user=user,
            category_name=product.category.name,
            content=f"Purchased {product.name}",
            amount=product.price * item.quantity,
            metadata_json={"quantity": item.quantity, "product_id": product.id, "variant_id": item.variant_id},
        )

    discount = 0.0
    if coupon and total >= coupon.minimum_spend:
        if coupon.discount_type == "percentage":
            discount = round(total * (coupon.discount_value / 100.0), 2)
        else:
            discount = min(total, coupon.discount_value)
        coupon.used_count += 1

    order.discount_amount = discount
    order.total_amount = max(total - discount + order.delivery_fee, 0)
    order.completed_at = datetime.utcnow()
    db.flush()

    order.timeline.extend(
        [
            OrderTimeline(status=OrderStatus.PAID, operator_account=user.username, note="Payment confirmed"),
            OrderTimeline(status=OrderStatus.PROCESSING, operator_account="system", note="Warehouse picking"),
            OrderTimeline(status=OrderStatus.SHIPPED, operator_account="system", note="Courier dispatched"),
        ]
    )
    order.shipping_updates.extend(
        [
            ShippingTracking(status_label="Package created", location="Shenzhen Warehouse", note="Label printed"),
            ShippingTracking(status_label="In transit", location="Regional sorting center", note="Departed hub"),
        ]
    )
    db.add(
        PaymentRecord(
            order=order,
            payment_method=payload.payment_method,
            transaction_id=f"TXN-{user.id}-{int(datetime.utcnow().timestamp())}",
            amount=order.total_amount,
            status=PaymentStatus.SUCCESS,
            paid_at=datetime.utcnow(),
        )
    )
    db.commit()
    db.refresh(order)
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product), joinedload(Order.timeline), joinedload(Order.shipping_updates))
        .filter(Order.id == order.id)
        .first()
    )
    return serialize_order(order)


@router.get("/history", response_model=list[OrderRead])
def order_history(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> list[OrderRead]:
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product), joinedload(Order.timeline), joinedload(Order.shipping_updates))
        .filter(Order.customer_id == user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [serialize_order(order) for order in orders]


@router.get("")
def list_orders(
    limit: int = 20,
    sort: str = "desc",
    status_filter: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    query = (
        db.query(Order)
        .options(joinedload(Order.customer), joinedload(Order.items).joinedload(OrderItem.product), joinedload(Order.payments))
    )
    if status_filter:
        query = query.filter(Order.status == status_filter)
    query = query.order_by(Order.created_at.asc() if sort == "asc" else Order.created_at.desc())
    orders = query.limit(limit).all()
    return [
        {
            "id": order.id,
            "customer": {
                "id": order.customer.id,
                "username": order.customer.username,
                "email": order.customer.email,
                "province": order.customer.province,
                "city": order.customer.city,
            },
            "status": order.status.value,
            "total_amount": order.total_amount,
            "created_at": order.created_at.isoformat(),
            "shipping_address": order.shipping_address,
            "items": [
                {
                    "product_id": item.product_id,
                    "product_name": item.product.name,
                    "quantity": item.quantity,
                    "variant_id": item.variant_id,
                    "image_url": item.product.image_url,
                    "thumbnail_url": item.product.thumbnail_url,
                    "category_name": item.product.category.name,
                }
                for item in order.items
            ],
            "payment": {
                "method": order.payment_method.value,
                "reference": order.payment_reference,
                "coupon_code": order.coupon_code,
            },
        }
        for order in orders
    ]
