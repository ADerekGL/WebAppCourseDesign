from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Banner, BannerStatus, HotSearchTrend, Product, ProductReview

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/hot-trends")
def hot_trends(
    q: str = Query(default=""),
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(HotSearchTrend).order_by(HotSearchTrend.rank.asc())
    if q:
        query = query.filter(HotSearchTrend.keyword.ilike(f"%{q}%"))
    return [
        {"keyword": row.keyword, "rank": row.rank, "search_count": row.search_count}
        for row in query.limit(12).all()
    ]


@router.get("/banners")
def banners(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.query(Banner).filter(Banner.status == BannerStatus.ACTIVE).order_by(Banner.click_count.desc()).all()
    return [
        {
            "id": banner.id,
            "title": banner.title,
            "subtitle": banner.subtitle,
            "image_url": banner.image_url,
            "target_url": banner.target_url,
            "click_count": banner.click_count,
        }
        for banner in rows
    ]


@router.get("")
def search_products(
    q: str = Query(default=""),
    category_id: int | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_rating: int | None = None,
    brand: str = Query(default=""),
    sort: str = Query(default="relevance"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(Product).filter(Product.is_active.is_(True))
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            (Product.name.ilike(pattern))
            | (Product.description.ilike(pattern))
            | (Product.brand.ilike(pattern))
        )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    if brand:
        query = query.filter(Product.brand.ilike(f"%{brand}%"))
    if min_rating is not None:
        query = query.outerjoin(ProductReview).group_by(Product.id).having(func.avg(ProductReview.rating) >= min_rating)

    if sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "newest":
        query = query.order_by(Product.created_at.desc())
    elif sort == "sales":
        query = query.order_by(Product.stock_quantity.asc())
    else:
        query = query.order_by(Product.updated_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "price": product.price,
                "stock_quantity": product.stock_quantity,
                "brand": product.brand,
                "image_url": product.image_url,
                "category_id": product.category_id,
                "category_name": product.category.name,
                "tags_json": product.tags_json or [],
            }
            for product in items
        ],
    }
