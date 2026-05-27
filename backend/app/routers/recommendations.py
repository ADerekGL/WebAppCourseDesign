from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_optional_user, require_roles
from ..models import Role, User
from ..schemas import RecommendationItem
from ..services.analytics import (
    business_rule_recommendations,
    content_based_recommendations,
    frequently_bought_together,
    recommend_products,
    trending_products,
)

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("/personalized", response_model=list[RecommendationItem])
def personalized(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> list[dict]:
    return recommend_products(db, user)


@router.get("/similar/{product_id}", response_model=list[RecommendationItem])
def similar(product_id: int, db: Session = Depends(get_db)) -> list[dict]:
    return content_based_recommendations(db, product_id)


@router.get("/trending", response_model=list[RecommendationItem])
def trending(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> list[dict]:
    return business_rule_recommendations(db, user) or trending_products(db)


@router.get("/frequently-bought-together/{product_id}", response_model=list[RecommendationItem])
def bought_together(product_id: int, db: Session = Depends(get_db)) -> list[dict]:
    return frequently_bought_together(db, product_id)
