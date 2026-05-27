from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_roles
from ..models import EventLog, Role, User
from ..schemas import DashboardResponse, RecommendationItem
from ..services.analytics import (
    build_dashboard,
    business_rule_recommendations,
    category_performance_matrix,
    churn_predictions,
    cohort_retention,
    conversion_funnel,
    geographic_sales,
    inventory_alerts,
    ltv_by_segment,
    recommend_products,
    recommendation_metrics,
    refresh_daily_stats,
    refresh_hot_searches,
    rfm_segments,
    sales_forecast_hint,
    stockout_predictions,
    user_journey_paths,
    war_room_dashboard,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> dict:
    return build_dashboard(db)


@router.get("/dashboard/war-room")
def dashboard_war_room(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> dict:
    return war_room_dashboard(db)


@router.get("/forecast")
def forecast(
    days: int = Query(default=7, ge=3, le=30),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return sales_forecast_hint(db, days=days)


@router.get("/rfm")
def rfm(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return rfm_segments(db)


@router.get("/cohorts")
def cohorts(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return cohort_retention(db)


@router.get("/funnel")
def funnel(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return conversion_funnel(db)


@router.get("/journeys")
def journeys(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return user_journey_paths(db)


@router.get("/ltv")
def ltv(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return ltv_by_segment(db)


@router.get("/category-performance")
def category_performance(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return category_performance_matrix(db)


@router.get("/geography")
def geography(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return geographic_sales(db)


@router.get("/inventory-alerts")
def inventory(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return inventory_alerts(db)


@router.get("/stockout-predictions")
def stockouts(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return stockout_predictions(db)


@router.get("/churn-predictions")
def churn(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    return churn_predictions(db)


@router.get("/recommendation-metrics")
def recommendation_metric_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> dict:
    return recommendation_metrics(db)


@router.get("/recommendations", response_model=list[RecommendationItem])
def recommendations(
    product_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> list[dict]:
    if product_id is None:
        return recommend_products(db, user)
    return recommend_products(db, user, product_id=product_id)


@router.post("/jobs/daily-stats")
def run_daily_stats(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
) -> dict:
    return refresh_daily_stats(db)


@router.post("/jobs/hot-searches")
def run_hot_searches(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.ADMIN)),
) -> list[dict]:
    return refresh_hot_searches(db)


@router.get("/logs")
def logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> list[dict]:
    records = db.query(EventLog).order_by(EventLog.created_at.desc()).limit(100).all()
    return [
        {
            "id": log.id,
            "event_type": log.event_type.value,
            "account": log.account,
            "ip_address": log.ip_address,
            "category_name": log.category_name,
            "content": log.content,
            "created_at": log.created_at.isoformat(),
        }
        for log in records
    ]
