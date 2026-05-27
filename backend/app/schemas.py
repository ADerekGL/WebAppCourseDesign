from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field

from .models import EventType, MembershipTier, OrderStatus, PaymentMethod, Role


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserRead"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8)


class UserRead(BaseModel):
    id: int
    username: str
    email: str
    role: Role
    is_verified: bool
    membership_tier: MembershipTier = MembershipTier.BRONZE

    model_config = {"from_attributes": True}


class PasswordResetRequest(BaseModel):
    email: EmailStr


class CategoryCreate(BaseModel):
    name: str
    description: str = ""
    parent_id: Optional[int] = None
    banner_image_url: str = ""
    seo_title: str = ""
    seo_description: str = ""


class CategoryRead(BaseModel):
    id: int
    name: str
    description: str
    parent_id: Optional[int] = None
    level: int = 1
    banner_image_url: str = ""
    seo_title: str = ""
    seo_description: str = ""

    model_config = {"from_attributes": True}


class ProductVariantCreate(BaseModel):
    sku: str
    color: str = ""
    size: str = ""
    weight: float = 0
    stock_quantity: int = 0
    image_url: str = ""
    extra_images_json: list[str] = Field(default_factory=list)
    is_default: bool = False


class ProductVariantRead(ProductVariantCreate):
    id: int

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    category_id: int
    name: str
    description: str
    price: float
    stock_quantity: int
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    sku: str = ""
    brand: str = ""
    safety_stock: int = 10
    supplier_name: str = ""
    base_weight: float = 0
    tags_json: list[str] = Field(default_factory=list)
    image_urls: list[str] = Field(default_factory=list)
    gallery_json: list[str] = Field(default_factory=list)
    variants: list[ProductVariantCreate] = Field(default_factory=list)


class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_active: Optional[bool] = None
    brand: Optional[str] = None
    safety_stock: Optional[int] = None
    supplier_name: Optional[str] = None
    base_weight: Optional[float] = None
    tags_json: Optional[list[str]] = None
    image_urls: Optional[list[str]] = None
    gallery_json: Optional[list[str]] = None


class ProductRead(BaseModel):
    id: int
    category_id: int
    category_name: str
    name: str
    description: str
    price: float
    stock_quantity: int
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    image_urls: list[str] = Field(default_factory=list)
    is_active: bool
    sku: str = ""
    brand: str = ""
    tags_json: list[str] = Field(default_factory=list)
    variants: list[ProductVariantRead] = Field(default_factory=list)
    rating_average: float = 0
    review_count: int = 0


class ProductReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str = ""
    content: str = ""
    review_images_json: list[str] = Field(default_factory=list)
    verified_purchase: bool = False


class ProductReviewRead(ProductReviewCreate):
    id: int
    user_name: str
    helpful_votes: int
    created_at: datetime


class CartItemInput(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    variant_id: Optional[int] = None


class CheckoutRequest(BaseModel):
    items: list[CartItemInput]
    shipping_address: str
    payment_method: PaymentMethod = PaymentMethod.CARD
    coupon_code: str = ""


class OrderItemRead(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    variant_id: Optional[int] = None
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    category_name: str = ""


class OrderTimelineRead(BaseModel):
    status: OrderStatus
    operator_account: str
    note: str
    created_at: datetime


class ShippingTrackingRead(BaseModel):
    status_label: str
    location: str
    note: str
    created_at: datetime


class OrderRead(BaseModel):
    id: int
    status: OrderStatus
    total_amount: float
    shipping_address: str
    created_at: datetime
    coupon_code: str = ""
    payment_method: PaymentMethod = PaymentMethod.CARD
    items: list[OrderItemRead]
    timeline: list[OrderTimelineRead] = Field(default_factory=list)
    shipping_updates: list[ShippingTrackingRead] = Field(default_factory=list)


class EventLogCreate(BaseModel):
    event_type: EventType
    product_id: Optional[int] = None
    category_name: str = ""
    content: str = ""
    dwell_seconds: int = 0
    amount: float = 0
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class DashboardSeriesPoint(BaseModel):
    label: str
    value: float


class DashboardResponse(BaseModel):
    top_products: list[DashboardSeriesPoint]
    sales_trends: list[DashboardSeriesPoint]
    anomaly_alerts: list[str]
    user_profile: dict[str, Any]
    category_sales: list[DashboardSeriesPoint]


class RecommendationItem(BaseModel):
    product_id: int
    product_name: str
    score: float
    reason: Literal["co_occurrence", "collaborative_filtering", "content_based", "business_rule", "fallback"]
    category_name: str = ""
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


class SalesAccountCreate(BaseModel):
    username: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role = Role.SALES


class SalesAccountPasswordReset(BaseModel):
    new_password: str = Field(min_length=8)


class UserAddressRead(BaseModel):
    contact_name: str
    phone: str
    province: str
    city: str
    district: str
    address_line: str
    postal_code: str
    is_default: bool


class UserProfileRead(BaseModel):
    id: int
    username: str
    email: str
    phone: str
    city: str
    province: str
    membership_tier: MembershipTier
    birth_date: Optional[date] = None
    preferred_categories_json: list[str] = Field(default_factory=list)
    addresses: list[UserAddressRead] = Field(default_factory=list)


class SearchSuggestionRead(BaseModel):
    keyword: str
    popularity: int


class FunnelStepRead(BaseModel):
    step: str
    users: int
    conversion_rate: float


class CohortRowRead(BaseModel):
    cohort: str
    retention: dict[str, float]


class RFMUserSegmentRead(BaseModel):
    segment: str
    users: int
    revenue: float


class DashboardKPIRead(BaseModel):
    gmv_today: float
    active_users_now: int
    orders_today: int
    alerts_count: int


class DashboardWarRoomRead(BaseModel):
    kpis: DashboardKPIRead
    trend_today_vs_yesterday: list[DashboardSeriesPoint]
    trend_30d: list[DashboardSeriesPoint]
    category_pie: list[DashboardSeriesPoint]
    top_products: list[DashboardSeriesPoint]
    geography: list[dict[str, Any]]
    retention_matrix: list[CohortRowRead]
    rfm_distribution: list[RFMUserSegmentRead]
    inventory_alerts: list[dict[str, Any]]
    transactions: list[dict[str, Any]]


Token.model_rebuild()
