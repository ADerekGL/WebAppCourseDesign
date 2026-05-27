from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..deps import get_optional_user, require_roles
from ..models import Category, EventType, Product, ProductReview, ProductVariant, Role, SearchLog, User
from ..schemas import (
    CategoryCreate,
    CategoryRead,
    ProductCreate,
    ProductRead,
    ProductReviewCreate,
    ProductReviewRead,
    ProductUpdate,
    ProductVariantRead,
)
from ..services.event_logger import log_event

router = APIRouter(prefix="/products", tags=["products"])


def serialize_product(product: Product) -> ProductRead:
    ratings = [review.rating for review in product.reviews]
    return ProductRead(
        id=product.id,
        category_id=product.category_id,
        category_name=product.category.name,
        name=product.name,
        description=product.description,
        price=product.price,
        stock_quantity=product.stock_quantity,
        image_url=product.image_url,
        thumbnail_url=product.thumbnail_url,
        image_urls=product.image_urls or product.gallery_json or ([product.image_url] if product.image_url else []),
        is_active=product.is_active,
        sku=product.sku,
        brand=product.brand,
        tags_json=product.tags_json or [],
        variants=[ProductVariantRead.model_validate(variant) for variant in product.variants],
        rating_average=round(sum(ratings) / len(ratings), 2) if ratings else 0,
        review_count=len(ratings),
    )


@router.get("", response_model=list[ProductRead])
def list_products(
    db: Session = Depends(get_db),
    category_id: int | None = None,
    search: str = Query(default=""),
    min_price: float | None = None,
    max_price: float | None = None,
    sort_by: str = Query(default="updated_at"),
    sort_order: str = Query(default="desc"),
) -> list[ProductRead]:
    query = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.variants), joinedload(Product.reviews))
        .filter(Product.is_active.is_(True))
    )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Product.name.ilike(pattern))
            | (Product.description.ilike(pattern))
            | (Product.brand.ilike(pattern))
        )
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    sortable_columns = {
        "price": Product.price,
        "name": Product.name,
        "created_at": Product.created_at,
        "updated_at": Product.updated_at,
        "stock_quantity": Product.stock_quantity,
    }
    order_column = sortable_columns.get(sort_by, Product.updated_at)
    query = query.order_by(order_column.asc() if sort_order == "asc" else order_column.desc())
    return [serialize_product(product) for product in query.all()]


@router.get("/categories", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)) -> list[Category]:
    return db.query(Category).order_by(Category.level.asc(), Category.name.asc()).all()


@router.post("/categories", response_model=CategoryRead)
def create_category(
    payload: CategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> Category:
    level = 1
    if payload.parent_id:
        parent = db.query(Category).filter(Category.id == payload.parent_id).first()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found")
        level = min(parent.level + 1, 3)

    category = Category(
        name=payload.name,
        description=payload.description,
        parent_id=payload.parent_id,
        level=level,
        slug=payload.name.lower().replace(" ", "-"),
        banner_image_url=payload.banner_image_url,
        seo_title=payload.seo_title or payload.name,
        seo_description=payload.seo_description or payload.description,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    log_event(db, request, EventType.OPERATION, user=user, category_name=category.name, content="Category created")
    return category


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> dict:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    name = category.name
    db.delete(category)
    db.commit()
    log_event(db, request, EventType.OPERATION, user=user, category_name=name, content="Category deleted")
    return {"message": "Category deleted"}


@router.post("", response_model=ProductRead)
def create_product(
    payload: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> ProductRead:
    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    product_data = payload.model_dump(exclude={"variants"})
    if not product_data.get("image_urls") and product_data.get("gallery_json"):
        product_data["image_urls"] = product_data["gallery_json"]
    if not product_data.get("gallery_json") and product_data.get("image_urls"):
        product_data["gallery_json"] = product_data["image_urls"]
    if not product_data["sku"]:
        product_data["sku"] = f"SKU-{payload.category_id}-{int(datetime.utcnow().timestamp() * 1000)}"

    product = Product(**product_data)
    db.add(product)
    db.flush()

    for index, variant_payload in enumerate(payload.variants):
        variant = ProductVariant(product_id=product.id, **variant_payload.model_dump())
        if index == 0 and not payload.variants[index].is_default:
            variant.is_default = True
        db.add(variant)

    db.commit()
    db.refresh(product)
    log_event(db, request, EventType.OPERATION, user=user, category_name=category.name, content=f"Product created: {product.name}")
    return serialize_product(product)


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.SALES, Role.ADMIN)),
) -> ProductRead:
    product = db.query(Product).options(joinedload(Product.category), joinedload(Product.variants), joinedload(Product.reviews)).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "image_urls":
            setattr(product, "gallery_json", value)
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    log_event(db, request, EventType.OPERATION, user=user, category_name=product.category.name, content=f"Product updated: {product.name}")
    return serialize_product(product)


@router.post("/{product_id}/browse")
def track_browse(
    product_id: int,
    request: Request,
    dwell_seconds: int = 0,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> dict:
    product = db.query(Product).options(joinedload(Product.category)).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    log_event(
        db,
        request,
        EventType.BROWSE,
        user=user,
        category_name=product.category.name,
        content=f"Viewed product {product.name}",
        dwell_seconds=dwell_seconds,
        metadata_json={"product_id": product.id, "region": request.headers.get("x-region", "unknown")},
    )
    return {"message": "Browse event captured"}


@router.post("/{product_id}/reviews", response_model=ProductReviewRead)
def create_review(
    product_id: int,
    payload: ProductReviewCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CUSTOMER)),
) -> ProductReviewRead:
    product = db.query(Product).filter(Product.id == product_id, Product.is_active.is_(True)).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    review = ProductReview(product_id=product.id, user_id=user.id, **payload.model_dump())
    db.add(review)
    db.commit()
    db.refresh(review)
    log_event(db, request, EventType.OPERATION, user=user, category_name=product.category.name, content=f"Submitted review for {product.name}")
    return ProductReviewRead(
        id=review.id,
        user_name=user.username,
        helpful_votes=review.helpful_votes,
        created_at=review.created_at,
        **payload.model_dump(),
    )


@router.get("/{product_id}/reviews", response_model=list[ProductReviewRead])
def list_reviews(product_id: int, db: Session = Depends(get_db)) -> list[ProductReviewRead]:
    reviews = (
        db.query(ProductReview)
        .options(joinedload(ProductReview.user))
        .filter(ProductReview.product_id == product_id)
        .order_by(ProductReview.created_at.desc())
        .all()
    )
    return [
        ProductReviewRead(
            id=review.id,
            rating=review.rating,
            title=review.title,
            content=review.content,
            review_images_json=review.review_images_json or [],
            verified_purchase=review.verified_purchase,
            helpful_votes=review.helpful_votes,
            user_name=review.user.username,
            created_at=review.created_at,
        )
        for review in reviews
    ]


@router.get("/{product_id}", response_model=ProductRead)
def get_product_detail(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> ProductRead:
    product = (
        db.query(Product)
        .options(joinedload(Product.category), joinedload(Product.variants), joinedload(Product.reviews))
        .filter(Product.id == product_id, Product.is_active.is_(True))
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if request.query_params.get("track_search"):
        keyword = request.query_params.get("track_search", "")
        if keyword:
            result_count = db.query(func.count(Product.id)).filter(Product.name.ilike(f"%{keyword}%")).scalar() or 0
            db.add(
                SearchLog(
                    user_id=user.id if user else None,
                    keyword=keyword,
                    result_count=result_count,
                    clicked_product_id=product.id,
                    click_position=1,
                    zero_result=result_count == 0,
                )
            )
            db.commit()
    return serialize_product(product)
