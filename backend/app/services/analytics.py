from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session, joinedload

from ..models import (
    DailyStat,
    EventLog,
    EventType,
    HotSearchTrend,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    RecommendationCache,
    Role,
    SearchLog,
    SuspiciousActivity,
    User,
)


def _items_dataframe(db: Session) -> pd.DataFrame:
    items = db.query(OrderItem).all()
    return pd.DataFrame(
        [
            {
                "order_id": item.order_id,
                "customer_id": item.order.customer_id,
                "product_id": item.product_id,
                "product_name": item.product.name,
                "category_name": item.product.category.name,
                "brand": item.product.brand,
                "quantity": item.quantity,
                "revenue": item.quantity * item.unit_price,
                "created_at": item.order.created_at,
                "province": item.order.customer.province,
                "city": item.order.customer.city,
            }
            for item in items
        ]
    )


def _events_dataframe(db: Session) -> pd.DataFrame:
    logs = db.query(EventLog).all()
    return pd.DataFrame(
        [
            {
                "id": log.id,
                "user_id": log.user_id,
                "account": log.account,
                "event_type": log.event_type.value,
                "ip_address": log.ip_address,
                "session_id": log.session_id,
                "device_type": log.device_type,
                "referrer_source": log.referrer_source,
                "landing_page": log.landing_page,
                "bounce_flag": log.bounce_flag,
                "category_name": log.category_name,
                "content": log.content,
                "dwell_seconds": log.dwell_seconds,
                "amount": log.amount,
                "metadata_json": log.metadata_json,
                "created_at": log.created_at,
            }
            for log in logs
        ]
    )


def build_dashboard(db: Session) -> dict:
    items_df = _items_dataframe(db)
    events_df = _events_dataframe(db)
    if items_df.empty:
        return {
            "top_products": [],
            "sales_trends": [],
            "anomaly_alerts": ["No transactional data available yet."],
            "user_profile": {"geographic_distribution": {}, "purchasing_power": "unknown", "preferences": []},
            "category_sales": [],
        }

    top_products_df = (
        items_df.groupby("product_name")["quantity"].sum().sort_values(ascending=False).head(5).reset_index()
    )
    trend_df = (
        items_df.assign(day=pd.to_datetime(items_df["created_at"]).dt.date)
        .groupby("day")["revenue"]
        .sum()
        .tail(14)
        .reset_index()
    )
    category_df = items_df.groupby("category_name")["revenue"].sum().sort_values(ascending=False).reset_index()

    return {
        "top_products": [{"label": row.product_name, "value": float(row.quantity)} for row in top_products_df.itertuples()],
        "sales_trends": [{"label": str(row.day), "value": float(row.revenue)} for row in trend_df.itertuples()],
        "anomaly_alerts": detect_sales_anomalies(items_df, events_df),
        "user_profile": build_user_profile(events_df, items_df),
        "category_sales": [{"label": row.category_name, "value": float(row.revenue)} for row in category_df.itertuples()],
    }


def detect_sales_anomalies(items_df: pd.DataFrame, events_df: pd.DataFrame) -> list[str]:
    alerts: list[str] = []
    if not items_df.empty:
        trend = items_df.assign(day=pd.to_datetime(items_df["created_at"]).dt.date).groupby("day")["revenue"].sum().sort_index()
        if len(trend) >= 7:
            baseline = trend.tail(7)
            mean = baseline.mean()
            std = baseline.std() or 1.0
            today = float(baseline.iloc[-1])
            if abs(today - mean) > 3 * std:
                alerts.append(f"Revenue anomaly: {today:.2f} deviates from 7-day mean {mean:.2f}")
    if not events_df.empty:
        traffic = events_df.assign(hour=pd.to_datetime(events_df["created_at"]).dt.floor("h")).groupby("hour").size().sort_index()
        if len(traffic) >= 8:
            latest = float(traffic.iloc[-1])
            mean = float(traffic.tail(8).mean())
            std = float(traffic.tail(8).std() or 1.0)
            if latest > mean + 3 * std:
                alerts.append(f"Traffic spike detected: {int(latest)} events in the latest hour")
    if not alerts:
        alerts.append("No abnormal sales or traffic patterns detected.")
    return alerts


def build_user_profile(events_df: pd.DataFrame, items_df: pd.DataFrame) -> dict:
    geographic_distribution: dict[str, int] = defaultdict(int)
    if not items_df.empty:
        for row in items_df.itertuples():
            region = "/".join(part for part in [row.province, row.city] if part) or "unknown"
            geographic_distribution[region] += int(row.quantity)

    avg_spend = float(items_df.groupby("customer_id")["revenue"].sum().mean()) if not items_df.empty else 0
    if avg_spend > 1500:
        purchasing_power = "high"
    elif avg_spend > 600:
        purchasing_power = "medium"
    else:
        purchasing_power = "entry"

    preferences = []
    if not items_df.empty:
        preferences = items_df.groupby("category_name")["quantity"].sum().sort_values(ascending=False).head(5).index.tolist()

    device_mix = {}
    if not events_df.empty and "device_type" in events_df:
        device_mix = events_df["device_type"].fillna("unknown").value_counts().head(5).to_dict()

    return {
        "geographic_distribution": dict(geographic_distribution),
        "purchasing_power": purchasing_power,
        "preferences": preferences,
        "device_mix": device_mix,
    }


def rfm_segments(db: Session) -> list[dict]:
    items_df = _items_dataframe(db)
    if items_df.empty:
        return []

    snapshot_date = pd.Timestamp(datetime.utcnow().date())
    grouped = items_df.groupby("customer_id").agg(
        recency=("created_at", lambda values: (snapshot_date - pd.to_datetime(max(values)).normalize()).days),
        frequency=("order_id", "nunique"),
        monetary=("revenue", "sum"),
    )

    grouped["r_score"] = pd.qcut(grouped["recency"].rank(method="first", ascending=False), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    grouped["f_score"] = pd.qcut(grouped["frequency"].rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int)
    grouped["m_score"] = pd.qcut(grouped["monetary"].rank(method="first"), 5, labels=[1, 2, 3, 4, 5]).astype(int)

    def label_segment(row: pd.Series) -> str:
        if row["r_score"] >= 4 and row["f_score"] >= 4 and row["m_score"] >= 4:
            return "Champions"
        if row["f_score"] >= 4 and row["m_score"] >= 3:
            return "Loyal"
        if row["r_score"] >= 4 and row["f_score"] <= 2:
            return "New"
        if row["r_score"] <= 2 and row["f_score"] >= 3:
            return "At Risk"
        if row["r_score"] <= 2 and row["f_score"] <= 2:
            return "Lost"
        return "Potential"

    grouped["segment"] = grouped.apply(label_segment, axis=1)
    grouped = grouped.reset_index()

    summary = grouped.groupby("segment").agg(users=("customer_id", "count"), revenue=("monetary", "sum")).reset_index()
    return [
        {"segment": row.segment, "users": int(row.users), "revenue": round(float(row.revenue), 2)}
        for row in summary.sort_values("revenue", ascending=False).itertuples()
    ]


def cohort_retention(db: Session) -> list[dict]:
    orders = db.query(Order).filter(Order.status != OrderStatus.CANCELLED).all()
    if not orders:
        return []

    df = pd.DataFrame(
        [{"customer_id": order.customer_id, "order_month": order.created_at.strftime("%Y-%m")} for order in orders]
    )
    first_purchase = df.groupby("customer_id")["order_month"].min().rename("cohort")
    df = df.join(first_purchase, on="customer_id")
    cohort_pivot = df.groupby(["cohort", "order_month"])["customer_id"].nunique().unstack(fill_value=0)

    results = []
    for cohort, row in cohort_pivot.iterrows():
        base = row.iloc[0] if row.iloc[0] else 1
        retention = {month: round(float(value / base * 100), 2) for month, value in row.items()}
        results.append({"cohort": cohort, "retention": retention})
    return results


def conversion_funnel(db: Session) -> list[dict]:
    events_df = _events_dataframe(db)
    if events_df.empty:
        return []

    stage_users = {
        "Visitor": int(events_df["account"].nunique()),
        "Product View": int(events_df.loc[events_df["event_type"] == EventType.BROWSE.value, "account"].nunique()),
        "Add Cart": int(events_df.loc[events_df["event_type"] == EventType.CART.value, "account"].nunique()),
        "Checkout": int(events_df.loc[events_df["content"].str.contains("checkout", case=False, na=False), "account"].nunique()),
        "Purchase": int(events_df.loc[events_df["event_type"] == EventType.PURCHASE.value, "account"].nunique()),
    }

    previous = stage_users["Visitor"] or 1
    funnel = []
    for step, users in stage_users.items():
        funnel.append({"step": step, "users": users, "conversion_rate": round(users / previous * 100, 2)})
        previous = users or 1
    return funnel


def sales_forecast_hint(db: Session, days: int = 7) -> list[dict]:
    items_df = _items_dataframe(db)
    if items_df.empty:
        return []

    ts = (
        items_df.assign(date=pd.to_datetime(items_df["created_at"]).dt.date)
        .groupby("date")["revenue"]
        .sum()
        .sort_index()
    )
    rolling = ts.rolling(window=7, min_periods=3).mean()
    weekly_pattern = ts.groupby(pd.to_datetime(ts.index).dayofweek).mean().to_dict()
    base_value = float(rolling.iloc[-1])
    last_day = max(ts.index)

    forecast = []
    for index in range(days):
        forecast_day = last_day + timedelta(days=index + 1)
        seasonal_multiplier = float(weekly_pattern.get(forecast_day.weekday(), base_value) / (ts.mean() or 1))
        projected = round(base_value * seasonal_multiplier, 2)
        forecast.append({"label": str(forecast_day), "value": projected})
    return forecast


def category_performance_matrix(db: Session) -> list[dict]:
    items_df = _items_dataframe(db)
    if items_df.empty:
        return []

    grouped = items_df.groupby("category_name").agg(
        revenue=("revenue", "sum"),
        units=("quantity", "sum"),
        orders=("order_id", "nunique"),
    )
    results = []
    for category_name, row in grouped.iterrows():
        margin = row["revenue"] * 0.22
        turnover_rate = row["units"] / max(row["orders"], 1)
        return_rate = min(6.0, max(0.5, turnover_rate / 10))
        results.append(
            {
                "category_name": category_name,
                "revenue": round(float(row["revenue"]), 2),
                "margin": round(float(margin), 2),
                "turnover_rate": round(float(turnover_rate), 2),
                "return_rate": round(float(return_rate), 2),
            }
        )
    return sorted(results, key=lambda item: item["revenue"], reverse=True)


def frequently_bought_together(db: Session, product_id: int) -> list[dict]:
    items_df = _items_dataframe(db)
    if items_df.empty:
        return []

    product_names = items_df.drop_duplicates("product_id").set_index("product_id")["product_name"].to_dict()
    counts: Counter[int] = Counter()
    for _, order_group in items_df.groupby("order_id"):
        product_ids = set(order_group["product_id"].tolist())
        if product_id in product_ids:
            for candidate in product_ids:
                if candidate != product_id:
                    counts[candidate] += 1
    product_images = {
        product.id: {"image_url": product.image_url, "thumbnail_url": product.thumbnail_url}
        for product in db.query(Product).filter(Product.id.in_(list(counts.keys()))).all()
    }
    return [
        {
            "product_id": candidate_id,
            "product_name": product_names.get(candidate_id, f"Product {candidate_id}"),
            "score": float(score),
            "reason": "co_occurrence",
            "category_name": "",
            "image_url": product_images.get(candidate_id, {}).get("image_url"),
            "thumbnail_url": product_images.get(candidate_id, {}).get("thumbnail_url"),
        }
        for candidate_id, score in counts.most_common(6)
    ]


def collaborative_filtering_recommendations(db: Session, items_df: pd.DataFrame, user_id: int) -> list[dict]:
    matrix = items_df.pivot_table(index="customer_id", columns="product_id", values="quantity", aggfunc="sum", fill_value=0)
    if user_id not in matrix.index or len(matrix.index) < 2:
        return []

    similarities = cosine_similarity(matrix)
    similarity_df = pd.DataFrame(similarities, index=matrix.index, columns=matrix.index)
    nearest = similarity_df.loc[user_id].drop(user_id).sort_values(ascending=False).head(5)

    user_items = set(items_df.loc[items_df["customer_id"] == user_id, "product_id"])
    names = items_df.drop_duplicates("product_id").set_index("product_id")["product_name"].to_dict()
    categories = items_df.drop_duplicates("product_id").set_index("product_id")["category_name"].to_dict()
    candidate_scores: dict[int, float] = defaultdict(float)
    for neighbor_id, score in nearest.items():
        for row in items_df.loc[items_df["customer_id"] == neighbor_id].itertuples():
            if row.product_id not in user_items:
                candidate_scores[row.product_id] += float(score) * float(row.quantity)
    product_images = {
        product.id: {"image_url": product.image_url, "thumbnail_url": product.thumbnail_url}
        for product in db.query(Product).filter(Product.id.in_(list(candidate_scores.keys()))).all()
    }

    return [
        {
            "product_id": product_id,
            "product_name": names.get(product_id, f"Product {product_id}"),
            "score": round(score, 3),
            "reason": "collaborative_filtering",
            "category_name": categories.get(product_id, ""),
            "image_url": product_images.get(product_id, {}).get("image_url"),
            "thumbnail_url": product_images.get(product_id, {}).get("thumbnail_url"),
        }
        for product_id, score in sorted(candidate_scores.items(), key=lambda item: item[1], reverse=True)[:8]
    ]


def content_based_recommendations(db: Session, product_id: int) -> list[dict]:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return []

    products = db.query(Product).filter(Product.is_active.is_(True), Product.id != product_id).all()
    candidates = []
    base_tags = set(product.tags_json or [])
    for candidate in products:
        score = 0.0
        if candidate.category_id == product.category_id:
            score += 3
        if candidate.brand and candidate.brand == product.brand:
            score += 1.5
        price_gap = abs(candidate.price - product.price)
        score += max(0, 2 - price_gap / max(product.price, 1))
        overlap = len(base_tags.intersection(candidate.tags_json or []))
        score += overlap * 1.2
        candidates.append(
            {
                "product_id": candidate.id,
                "product_name": candidate.name,
                "score": round(score, 3),
                "reason": "content_based",
                "category_name": candidate.category.name,
                "image_url": candidate.image_url,
                "thumbnail_url": candidate.thumbnail_url,
            }
        )
    return sorted(candidates, key=lambda item: item["score"], reverse=True)[:8]


def business_rule_recommendations(db: Session, user: User | None = None) -> list[dict]:
    trending = trending_products(db, limit=12)
    season = datetime.utcnow().month
    season_keywords = {"winter": {"heater", "coat", "blanket"}, "summer": {"sports", "outdoor", "fan"}}
    seasonal_tags = season_keywords["winter"] if season in {11, 12, 1, 2} else season_keywords["summer"]

    curated = []
    for item in trending:
        score = item["score"]
        product = db.query(Product).filter(Product.id == item["product_id"]).first()
        if not product:
            continue
        if seasonal_tags.intersection(set(tag.lower() for tag in (product.tags_json or []))):
            score += 2
        curated.append({**item, "reason": "business_rule", "score": round(score, 3), "category_name": product.category.name})
    return curated[:8]


def recommend_products(db: Session, user: User, product_id: int | None = None) -> list[dict]:
    cached = db.query(RecommendationCache).filter(RecommendationCache.user_id == user.id).first()
    if cached and not product_id:
        return cached.recommendations_json[:8]

    items_df = _items_dataframe(db)
    recommendations: list[dict] = []
    if not items_df.empty:
        recommendations.extend(collaborative_filtering_recommendations(db, items_df, user.id))
        if product_id is not None:
            recommendations.extend(frequently_bought_together(db, product_id))
            recommendations.extend(content_based_recommendations(db, product_id))
    recommendations.extend(business_rule_recommendations(db, user))

    deduped: dict[int, dict] = {}
    for candidate in recommendations:
        deduped.setdefault(candidate["product_id"], candidate)

    if not deduped:
        fallback = db.query(Product).filter(Product.is_active.is_(True)).limit(8).all()
        for product in fallback:
            deduped[product.id] = {
                "product_id": product.id,
                "product_name": product.name,
                "score": 0.1,
                "reason": "fallback",
                "category_name": product.category.name,
                "image_url": product.image_url,
                "thumbnail_url": product.thumbnail_url,
            }

    blended = list(deduped.values())[:8]
    if not cached:
        db.add(RecommendationCache(user_id=user.id, recommendations_json=blended))
    else:
        cached.recommendations_json = blended
        cached.generated_at = datetime.utcnow()
    db.commit()
    return blended


def trending_products(db: Session, limit: int = 20) -> list[dict]:
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    items = db.query(OrderItem).join(Order).filter(Order.created_at >= seven_days_ago).all()
    scores: dict[int, float] = defaultdict(float)
    product_names: dict[int, str] = {}
    product_images: dict[int, dict[str, str | None]] = {}
    for item in items:
        score = item.quantity / max((datetime.utcnow() - item.order.created_at).days + 1, 1)
        scores[item.product_id] += score
        product_names[item.product_id] = item.product.name
        product_images[item.product_id] = {
            "image_url": item.product.image_url,
            "thumbnail_url": item.product.thumbnail_url,
        }
    ordered = sorted(scores.items(), key=lambda row: row[1], reverse=True)[:limit]
    return [
        {
            "product_id": product_id,
            "product_name": product_names.get(product_id, f"Product {product_id}"),
            "score": round(score, 3),
            "reason": "business_rule",
            "image_url": product_images.get(product_id, {}).get("image_url"),
            "thumbnail_url": product_images.get(product_id, {}).get("thumbnail_url"),
        }
        for product_id, score in ordered
    ]


def search_suggestions(db: Session, keyword: str) -> list[dict]:
    query = db.query(HotSearchTrend).order_by(HotSearchTrend.rank.asc())
    if keyword:
        query = query.filter(HotSearchTrend.keyword.ilike(f"%{keyword}%"))
    rows = query.limit(10).all()
    return [{"keyword": row.keyword, "popularity": row.search_count} for row in rows]


def user_journey_paths(db: Session) -> list[dict]:
    events_df = _events_dataframe(db)
    if events_df.empty or "session_id" not in events_df:
        return []

    paths = Counter()
    sorted_df = events_df.sort_values("created_at")
    for _, session_df in sorted_df.groupby("session_id"):
        steps = session_df["event_type"].tolist()[:5]
        if len(steps) >= 2:
            for current, nxt in zip(steps, steps[1:]):
                paths[(current, nxt)] += 1
    return [{"source": source, "target": target, "value": count} for (source, target), count in paths.most_common(12)]


def ltv_by_segment(db: Session) -> list[dict]:
    segments = rfm_segments(db)
    results = []
    for segment in segments:
        multiplier = {
            "Champions": 4.0,
            "Loyal": 3.0,
            "Potential": 2.2,
            "New": 1.8,
            "At Risk": 1.3,
            "Lost": 0.8,
        }.get(segment["segment"], 1.5)
        average_revenue = segment["revenue"] / max(segment["users"], 1)
        results.append(
            {"segment": segment["segment"], "users": segment["users"], "predicted_ltv": round(average_revenue * multiplier, 2)}
        )
    return results


def geographic_sales(db: Session) -> list[dict]:
    items_df = _items_dataframe(db)
    if items_df.empty:
        return []
    geo = items_df.groupby(["province", "city"])["revenue"].sum().reset_index()
    return [
        {"province": row.province or "Unknown", "city": row.city or "Unknown", "value": round(float(row.revenue), 2)}
        for row in geo.itertuples()
    ]


def inventory_alerts(db: Session) -> list[dict]:
    products = db.query(Product).all()
    alerts = []
    for product in products:
        total_variant_stock = sum(variant.stock_quantity for variant in product.variants) if product.variants else product.stock_quantity
        days_of_inventory = round(total_variant_stock / max(_sales_velocity(db, product.id), 1), 2)
        if total_variant_stock <= product.safety_stock:
            alerts.append(
                {
                    "product_id": product.id,
                    "product_name": product.name,
                    "stock_quantity": total_variant_stock,
                    "safety_stock": product.safety_stock,
                    "days_of_inventory": days_of_inventory,
                }
            )
    return sorted(alerts, key=lambda item: item["stock_quantity"])[:20]


def _sales_velocity(db: Session, product_id: int) -> float:
    since = datetime.utcnow() - timedelta(days=30)
    items = db.query(OrderItem).join(Order).filter(Order.created_at >= since, OrderItem.product_id == product_id).all()
    return sum(item.quantity for item in items) / 30 if items else 0.1


def stockout_predictions(db: Session) -> list[dict]:
    predictions = []
    for product in db.query(Product).all():
        daily_velocity = _sales_velocity(db, product.id)
        stock_days = product.stock_quantity / max(daily_velocity, 0.1)
        if stock_days <= 7:
            predictions.append({"product_id": product.id, "product_name": product.name, "days_left": round(stock_days, 2)})
    return sorted(predictions, key=lambda item: item["days_left"])[:20]


def churn_predictions(db: Session) -> list[dict]:
    users = db.query(User).filter(User.role == Role.CUSTOMER).all()
    risky = []
    for user in users:
        last_order = max((order.created_at for order in user.orders), default=None)
        days_since = 999 if last_order is None else (datetime.utcnow() - last_order).days
        if days_since >= 60:
            risky.append({"user_id": user.id, "username": user.username, "days_since_purchase": days_since})
    return sorted(risky, key=lambda item: item["days_since_purchase"], reverse=True)[:50]


def recommendation_metrics(db: Session) -> dict:
    caches = db.query(RecommendationCache).all()
    products = db.query(Product).count() or 1
    recommended_product_ids = set()
    categories_per_user = []
    for cache in caches:
        categories = []
        for item in cache.recommendations_json:
            recommended_product_ids.add(item["product_id"])
            if item.get("category_name"):
                categories.append(item["category_name"])
        categories_per_user.append(len(set(categories)))
    diversity = round(float(np.mean(categories_per_user)), 2) if categories_per_user else 0
    return {
        "coverage": round(len(recommended_product_ids) / products * 100, 2),
        "diversity": diversity,
        "mock_ctr": 6.8,
        "mock_conversion_rate": 3.1,
    }


def business_insights(db: Session) -> dict:
    items_df = _items_dataframe(db)
    events_df = _events_dataframe(db)
    rec_metrics = recommendation_metrics(db)
    low_stock_items = inventory_alerts(db)
    churn_risks = churn_predictions(db)

    if items_df.empty and events_df.empty:
        return {
            "headline": "No operational data available yet. Seed data to unlock recommendation, forecast, and monitoring signals.",
            "metrics": [
                {"label": "7d GMV", "value": "CNY 0", "detail": "No transactional history"},
                {"label": "7d Orders", "value": "0", "detail": "No orders yet"},
                {"label": "AOV", "value": "CNY 0", "detail": "Average order value"},
                {"label": "Recommendation Coverage", "value": "0%", "detail": "No recommendation cache"},
            ],
            "signals": [
                {"label": "Data status", "detail": "Seeded data is required to surface product and user signals.", "tone": "warning"}
            ],
            "actions": [
                {"title": "Load synthetic data", "detail": "Run the enhanced seed job so the platform can surface operational insights."},
            ],
            "recommendation_health": rec_metrics,
            "evaluation_notes": [
                "Recommendation metrics are offline proxies derived from cached recommendations.",
                "Forecast and churn signals are designed for course-level demonstrations, not financial decisions.",
            ],
        }

    items_df = items_df.copy()
    items_df["created_at"] = pd.to_datetime(items_df["created_at"])
    events_df = events_df.copy()
    events_df["created_at"] = pd.to_datetime(events_df["created_at"])

    today = pd.Timestamp(datetime.utcnow().date())
    window_start = today - pd.Timedelta(days=7)
    prev_window_start = today - pd.Timedelta(days=14)

    recent_items = items_df[items_df["created_at"] >= window_start]
    prior_items = items_df[(items_df["created_at"] < window_start) & (items_df["created_at"] >= prev_window_start)]
    gmv_7d = float(recent_items["revenue"].sum()) if not recent_items.empty else 0.0
    gmv_prev_7d = float(prior_items["revenue"].sum()) if not prior_items.empty else 0.0
    orders_7d = int(recent_items["order_id"].nunique()) if not recent_items.empty else 0
    aov = gmv_7d / max(orders_7d, 1)
    gmv_growth = round(((gmv_7d - gmv_prev_7d) / gmv_prev_7d) * 100, 2) if gmv_prev_7d else 0.0

    recent_events = events_df[events_df["created_at"] >= window_start]
    browse_count = int((recent_events["event_type"] == EventType.BROWSE.value).sum()) if not recent_events.empty else 0
    purchase_count = int((recent_events["event_type"] == EventType.PURCHASE.value).sum()) if not recent_events.empty else 0
    conversion_rate = round((purchase_count / max(browse_count, 1)) * 100, 2) if browse_count else 0.0

    category_momentum = []
    if not recent_items.empty:
      recent_category = recent_items.groupby("category_name")["revenue"].sum()
      prior_category = prior_items.groupby("category_name")["revenue"].sum() if not prior_items.empty else pd.Series(dtype=float)
      all_categories = sorted(set(recent_category.index.tolist()) | set(prior_category.index.tolist()))
      for category_name in all_categories:
          recent_value = float(recent_category.get(category_name, 0.0))
          prior_value = float(prior_category.get(category_name, 0.0)) if not prior_category.empty else 0.0
          delta = recent_value - prior_value
          growth = round((delta / prior_value) * 100, 2) if prior_value else 0.0
          category_momentum.append((category_name, recent_value, delta, growth))
      category_momentum.sort(key=lambda row: row[2], reverse=True)

    top_category = category_momentum[0] if category_momentum else ("Unknown", 0.0, 0.0, 0.0)
    top_product_row = (
        recent_items.groupby(["product_id", "product_name"])["quantity"].sum().sort_values(ascending=False).head(1)
        if not recent_items.empty
        else pd.Series(dtype=float)
    )
    top_product_name = "N/A"
    if not top_product_row.empty:
        product_index = top_product_row.index[0]
        top_product_name = product_index[1] if isinstance(product_index, tuple) else str(product_index)

    signals = [
        {
            "label": "Category momentum",
            "detail": f"{top_category[0]} generated CNY {top_category[1]:.2f} in the last 7 days, {top_category[3]:.2f}% vs the previous window.",
            "tone": "positive" if top_category[2] >= 0 else "warning",
        },
        {
            "label": "Conversion proxy",
            "detail": f"{conversion_rate:.2f}% browse-to-purchase proxy, based on recent event logs.",
            "tone": "positive" if conversion_rate >= 4 else "neutral",
        },
        {
            "label": "Inventory pressure",
            "detail": f"{len(low_stock_items)} products are at or below safety stock.",
            "tone": "warning" if low_stock_items else "neutral",
        },
        {
            "label": "Retention risk",
            "detail": f"{len(churn_risks)} customers are flagged as reactivation candidates.",
            "tone": "warning" if churn_risks else "neutral",
        },
    ]

    actions = []
    if top_category[0] != "Unknown":
        actions.append(
            {
                "title": "Boost top category exposure",
                "detail": f"Prioritize {top_category[0]} in homepage modules and campaign slots to capture current momentum.",
            }
        )
    if low_stock_items:
        risky_product = low_stock_items[0]
        actions.append(
            {
                "title": "Replenish stock first",
                "detail": f"{risky_product['product_name']} is within {risky_product['days_of_inventory']} days of inventory.",
            }
        )
    if churn_risks:
        risky_user = churn_risks[0]
        actions.append(
            {
                "title": "Run a reactivation campaign",
                "detail": f"Target {risky_user['username']} and similar dormant users with a re-engagement incentive.",
            }
        )
    if rec_metrics.get("coverage", 0) < 50:
        actions.append(
            {
                "title": "Refresh recommendation cache",
                "detail": "Coverage is below a healthy threshold, so a cache refresh or broader fallback policy is needed.",
            }
        )

    if not actions:
        actions.append(
            {
                "title": "Maintain current operating mix",
                "detail": "Current signals are balanced, so the platform can keep the present recommendation and inventory policy.",
            }
        )

    headline = (
        f"7-day GMV reached CNY {gmv_7d:,.2f} with {gmv_growth:+.2f}% growth vs the previous window, "
        f"while {len(low_stock_items)} low-stock items and {len(churn_risks)} reactivation candidates define the next operating focus."
    )

    return {
        "headline": headline,
        "metrics": [
            {"label": "7d GMV", "value": f"CNY {gmv_7d:,.0f}", "detail": f"{gmv_growth:+.2f}% vs previous 7d"},
            {"label": "7d Orders", "value": str(orders_7d), "detail": "Completed order count"},
            {"label": "AOV", "value": f"CNY {aov:,.2f}", "detail": "Average order value"},
            {"label": "Browse->Buy", "value": f"{conversion_rate:.2f}%", "detail": "Event-log conversion proxy"},
        ],
        "signals": signals,
        "actions": actions,
        "recommendation_health": rec_metrics,
        "evaluation_notes": [
            f"Top product momentum: {top_product_name}",
            "Recommendation health is based on cached coverage, diversity, and mock CTR proxies.",
            "Forecast and churn outputs are course-scale heuristics built for product discussion, not production decisioning.",
        ],
    }


def recommendation_explanation(db: Session, product_id: int, user: User | None = None) -> dict:
    product = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.id == product_id, Product.is_active.is_(True))
        .first()
    )
    if not product:
        return {
            "product_id": product_id,
            "product_name": f"Product {product_id}",
            "summary": "The product could not be found.",
            "reasons": [],
            "score": 0.0,
        }

    items_df = _items_dataframe(db)
    reasons: list[dict[str, str]] = []
    score = 0.0

    if not items_df.empty:
        items_df = items_df.copy()
        items_df["created_at"] = pd.to_datetime(items_df["created_at"])
        window_start = pd.Timestamp(datetime.utcnow().date()) - pd.Timedelta(days=14)
        recent_product_sales = items_df[(items_df["product_id"] == product_id) & (items_df["created_at"] >= window_start)]
        category_sales = items_df[(items_df["category_name"] == product.category.name) & (items_df["created_at"] >= window_start)]
        if not recent_product_sales.empty:
            recent_revenue = float(recent_product_sales["revenue"].sum())
            reasons.append(
                {
                    "label": "Demand signal",
                    "detail": f"{product.name} generated CNY {recent_revenue:,.2f} in the last 14 days, showing active demand.",
                    "tone": "positive",
                }
            )
            score += 28
        if not category_sales.empty:
            category_revenue = float(category_sales["revenue"].sum())
            reasons.append(
                {
                    "label": "Category fit",
                    "detail": f"{product.category.name} is active in the recent sales window with CNY {category_revenue:,.2f} revenue.",
                    "tone": "positive",
                }
            )
            score += 22

    if product.brand:
        brand_match = db.query(Product).filter(Product.brand == product.brand, Product.id != product.id, Product.is_active.is_(True)).count()
        if brand_match:
            reasons.append(
                {
                    "label": "Brand adjacency",
                    "detail": f"There are {brand_match} active products in the same brand family, which improves cross-sell consistency.",
                    "tone": "neutral",
                }
            )
            score += 10

    tag_overlap = len(set(product.tags_json or []))
    if tag_overlap:
        reasons.append(
            {
                "label": "Tag coverage",
                "detail": f"{tag_overlap} product tags help the ranking layer explain the product's positioning.",
                "tone": "neutral",
            }
        )
        score += min(tag_overlap * 4, 16)

    bundle_candidates = frequently_bought_together(db, product_id)[:2]
    if bundle_candidates:
        names = " and ".join(item["product_name"] for item in bundle_candidates[:2])
        reasons.append(
            {
                "label": "Bundle potential",
                "detail": f"It is frequently purchased together with {names}, which supports cross-sell modules.",
                "tone": "positive",
            }
        )
        score += 25

    if user and product.category.name in (user.preferred_categories_json or []):
        reasons.append(
            {
                "label": "Audience fit",
                "detail": f"The current user profile already prefers {product.category.name}, so this item fits the browsing intent.",
                "tone": "positive",
            }
        )
        score += 15

    if not reasons:
        reasons.append(
            {
                "label": "Fallback reasoning",
                "detail": "The item is surfaced through category and business-rule fallback logic when behavioral data is sparse.",
                "tone": "neutral",
            }
        )

    summary = f"{product.name} is recommended through a mix of demand, category, and cross-sell signals."
    if user and product.category.name in (user.preferred_categories_json or []):
        summary = f"{product.name} matches the user's category preference and is reinforced by demand and bundle signals."

    return {
        "product_id": product.id,
        "product_name": product.name,
        "summary": summary,
        "reasons": reasons[:4],
        "score": round(min(score, 100.0), 2),
    }


def war_room_dashboard(db: Session) -> dict:
    today = datetime.utcnow().date()
    yesterday = today - timedelta(days=1)
    items_df = _items_dataframe(db)
    todays_items = items_df[pd.to_datetime(items_df["created_at"]).dt.date == today] if not items_df.empty else pd.DataFrame()
    yesterdays_items = items_df[pd.to_datetime(items_df["created_at"]).dt.date == yesterday] if not items_df.empty else pd.DataFrame()

    def hourly_series(source_df: pd.DataFrame) -> dict[int, float]:
        if source_df.empty:
            return {}
        grouped = source_df.groupby(pd.to_datetime(source_df["created_at"]).dt.hour)["revenue"].sum()
        return {int(hour): float(value) for hour, value in grouped.items()}

    today_hourly = hourly_series(todays_items)
    yesterday_hourly = hourly_series(yesterdays_items)
    trend_today_vs_yesterday = [
        {"label": f"{hour:02d}:00", "value": round(today_hourly.get(hour, 0) - yesterday_hourly.get(hour, 0), 2)}
        for hour in range(24)
    ]
    trend_30d = sales_forecast_hint(db, days=30)
    category_pie = build_dashboard(db)["category_sales"]
    top_products = build_dashboard(db)["top_products"]
    transactions = [
        {
            "order_id": order.id,
            "username": order.customer.username,
            "avatar_url": order.customer.avatar_url,
            "amount": order.total_amount,
            "created_at": order.created_at.isoformat(),
        }
        for order in db.query(Order).order_by(Order.created_at.desc()).limit(20).all()
    ]

    return {
        "kpis": {
            "gmv_today": round(float(todays_items["revenue"].sum()) if not todays_items.empty else 0, 2),
            "active_users_now": int(db.query(EventLog).filter(EventLog.created_at >= datetime.utcnow() - timedelta(minutes=10)).count()),
            "orders_today": int(db.query(Order).filter(Order.created_at >= datetime.combine(today, datetime.min.time())).count()),
            "alerts_count": int(db.query(SuspiciousActivity).count() + len(inventory_alerts(db))),
        },
        "trend_today_vs_yesterday": trend_today_vs_yesterday,
        "trend_30d": trend_30d,
        "category_pie": category_pie,
        "top_products": top_products,
        "geography": geographic_sales(db),
        "retention_matrix": cohort_retention(db),
        "rfm_distribution": rfm_segments(db),
        "inventory_alerts": inventory_alerts(db),
        "transactions": transactions,
    }


def refresh_daily_stats(db: Session) -> dict:
    items_df = _items_dataframe(db)
    events_df = _events_dataframe(db)
    if items_df.empty and events_df.empty:
        return {"message": "No data available for aggregation."}

    order_by_day = items_df.assign(day=pd.to_datetime(items_df["created_at"]).dt.date).groupby("day").agg(
        revenue=("revenue", "sum"),
        orders_count=("order_id", "nunique"),
        active_users=("customer_id", "nunique"),
    ) if not items_df.empty else pd.DataFrame()

    event_by_day = events_df.assign(day=pd.to_datetime(events_df["created_at"]).dt.date).groupby(["day", "event_type"]).size().unstack(fill_value=0) if not events_df.empty else pd.DataFrame()

    all_days = sorted(set(order_by_day.index.tolist() if not order_by_day.empty else []) | set(event_by_day.index.tolist() if not event_by_day.empty else []))
    for day in all_days:
        stat = db.query(DailyStat).filter(DailyStat.stat_date == day).first()
        if not stat:
            stat = DailyStat(stat_date=day)
            db.add(stat)
        if not order_by_day.empty and day in order_by_day.index:
            stat.revenue = float(order_by_day.loc[day, "revenue"])
            stat.orders_count = int(order_by_day.loc[day, "orders_count"])
            stat.active_users = int(order_by_day.loc[day, "active_users"])
        if not event_by_day.empty and day in event_by_day.index:
            row = event_by_day.loc[day]
            stat.browse_events = int(row.get(EventType.BROWSE.value, 0))
            stat.cart_events = int(row.get(EventType.CART.value, 0))
            stat.search_events = int(row.get(EventType.SEARCH.value, 0))
        stat.new_users = db.query(User).filter(User.created_at >= datetime.combine(day, datetime.min.time()), User.created_at < datetime.combine(day + timedelta(days=1), datetime.min.time())).count()
        stat.generated_at = datetime.utcnow()
    db.commit()
    return {"message": f"Daily stats refreshed for {len(all_days)} day(s)."}


def refresh_hot_searches(db: Session) -> list[dict]:
    since = datetime.utcnow() - timedelta(hours=1)
    rows = (
        db.query(SearchLog)
        .filter(SearchLog.created_at >= since)
        .all()
    )
    counts = Counter(row.keyword for row in rows)
    db.query(HotSearchTrend).delete()
    trends = []
    for rank, (keyword, count) in enumerate(counts.most_common(20), start=1):
        trend = HotSearchTrend(keyword=keyword, rank=rank, search_count=count, window_label="hourly")
        db.add(trend)
        trends.append({"keyword": keyword, "rank": rank, "search_count": count})
    db.commit()
    return trends
