from __future__ import annotations

import logging

from fastapi import Request
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..models import EventLog, EventType, User

logger = logging.getLogger(__name__)


def get_ip_address(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


def log_event(
    db: Session,
    request: Request,
    event_type: EventType,
    user: User | None = None,
    account: str | None = None,
    category_name: str = "",
    content: str = "",
    dwell_seconds: int = 0,
    amount: float = 0,
    metadata_json: dict | None = None,
) -> None:
    event = EventLog(
        user_id=user.id if user else None,
        account=account or (user.username if user else "anonymous"),
        event_type=event_type,
        ip_address=get_ip_address(request),
        category_name=category_name,
        content=content,
        dwell_seconds=dwell_seconds,
        amount=amount,
        metadata_json=metadata_json or {},
    )
    try:
        db.add(event)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning("Event logging failed for %s: %s", event_type.value, exc)
