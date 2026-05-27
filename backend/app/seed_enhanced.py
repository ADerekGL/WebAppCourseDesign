from __future__ import annotations

import random
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from faker import Faker
import numpy as np

from .database import SessionLocal, create_all_and_migrate
from .models import (
    Banner,
    BannerStatus,
    Category,
    Coupon,
    DailyStat,
    EmailLog,
    EventLog,
    EventType,
    HotSearchTrend,
    InventoryChangeType,
    InventoryLog,
    MembershipTier,
    Order,
    OrderItem,
    OrderStatus,
    OrderTimeline,
    PaymentMethod,
    PaymentRecord,
    PaymentStatus,
    Product,
    ProductReview,
    ProductVariant,
    RecommendationCache,
    Role,
    SearchLog,
    ShippingTracking,
    SuspiciousActivity,
    User,
    UserAddress,
    UserBehaviorSession,
    UserCoupon,
    WishlistItem,
)
from .security import hash_password

fake_cn = Faker("zh_CN")
fake_en = Faker("en_US")
random.seed(42)
Faker.seed(42)

TIER_1_CITIES = [("Beijing", "Beijing"), ("Shanghai", "Shanghai"), ("Guangdong", "Guangzhou"), ("Guangdong", "Shenzhen")]
TIER_2_CITIES = [
    ("Zhejiang", "Hangzhou"),
    ("Sichuan", "Chengdu"),
    ("Hubei", "Wuhan"),
    ("Shaanxi", "Xi'an"),
    ("Jiangsu", "Nanjing"),
]
TIER_3_CITIES = [
    ("Anhui", "Hefei"),
    ("Shandong", "Jinan"),
    ("Fujian", "Xiamen"),
    ("Henan", "Zhengzhou"),
    ("Jilin", "Changchun"),
]


@dataclass
class CategorySeed:
    name: str
    children: list["CategorySeed"]


CATEGORY_TREE = [
    CategorySeed("Electronics", [CategorySeed("Phones", []), CategorySeed("Computers", []), CategorySeed("Smart Home", [])]),
    CategorySeed("Clothing", [CategorySeed("Men", []), CategorySeed("Women", []), CategorySeed("Kids", [])]),
    CategorySeed("Food", [CategorySeed("Snacks", []), CategorySeed("Beverages", []), CategorySeed("Fresh", [])]),
    CategorySeed("Books", [CategorySeed("Technology", []), CategorySeed("Business", []), CategorySeed("Lifestyle", [])]),
    CategorySeed("Home", [CategorySeed("Kitchen", []), CategorySeed("Furniture", []), CategorySeed("Decor", [])]),
    CategorySeed("Sports", [CategorySeed("Outdoor", []), CategorySeed("Fitness", []), CategorySeed("Cycling", [])]),
    CategorySeed("Beauty", [CategorySeed("Skincare", []), CategorySeed("Makeup", []), CategorySeed("Personal Care", [])]),
]


PRODUCT_TAGS = ["trending", "new-arrival", "bestseller", "limited-stock", "seasonal", "bundle"]
PAYMENT_METHODS = [PaymentMethod.ALIPAY, PaymentMethod.WECHAT, PaymentMethod.CARD]
SEARCH_TERMS = [
    "iphone case",
    "wireless earbuds",
    "running shoes",
    "protein powder",
    "lipstick",
    "notebook",
    "coffee machine",
    "gaming keyboard",
    "winter coat",
    "air fryer",
    "baby stroller",
    "standing desk",
]

CATEGORY_IMAGE_OFFSETS = {
    "Electronics": 1000,
    "Clothing": 2000,
    "Food": 3000,
    "Books": 4000,
    "Home": 5000,
    "Sports": 6000,
    "Beauty": 7000,
    "Toys": 8000,
    "Automotive": 9000,
}


def random_city() -> tuple[str, str]:
    roll = random.random()
    if roll < 0.40:
        return random.choice(TIER_1_CITIES)
    if roll < 0.75:
        return random.choice(TIER_2_CITIES)
    return random.choice(TIER_3_CITIES)


def recent_datetime(months_back: int = 12) -> datetime:
    now = datetime.utcnow()
    day_offset = random.randint(0, months_back * 30)
    base = now - timedelta(days=day_offset)
    hour_choices = [10, 12, 15, 20, 21, 22, 23]
    weights = [0.08, 0.10, 0.12, 0.18, 0.20, 0.18, 0.14]
    hour = random.choices(hour_choices, weights=weights, k=1)[0]
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    base = base.replace(hour=hour, minute=minute, second=second, microsecond=0)
    if base.weekday() >= 5 and random.random() < 0.55:
        base += timedelta(hours=random.randint(0, 2))
    return base


def seasonal_category_bias(month: int) -> dict[str, float]:
    if month in {6, 7, 8}:
        return {"Sports": 1.4, "Home": 0.9, "Clothing": 0.9}
    if month in {11, 12, 1, 2}:
        return {"Clothing": 1.5, "Home": 1.2, "Sports": 0.8}
    return {"Electronics": 1.2, "Beauty": 1.1}


def get_product_image_urls(product_id: int, category_name: str) -> dict[str, str]:
    category_seed_offset = CATEGORY_IMAGE_OFFSETS.get(category_name, 0)
    seed = category_seed_offset + product_id
    return {
        "image_url": f"https://picsum.photos/seed/{seed}/800/800",
        "thumbnail_url": f"https://picsum.photos/seed/{seed}/400/400",
    }


def create_categories(db) -> list[Category]:
    created: list[Category] = []

    def add_node(seed: CategorySeed, parent: Category | None = None, level: int = 1) -> None:
        category = Category(
            name=seed.name if not parent else f"{parent.name} / {seed.name}",
            description=f"{seed.name} assortment and curated merchandising.",
            parent_id=parent.id if parent else None,
            level=level,
            slug=seed.name.lower().replace(" ", "-"),
            banner_image_url=f"https://example.com/{seed.name.lower().replace(' ', '-')}.jpg",
            seo_title=f"{seed.name} deals and analytics",
            seo_description=f"Browse top {seed.name.lower()} picks with analytics-ready merchandising.",
        )
        db.add(category)
        db.flush()
        created.append(category)
        for child in seed.children:
            add_node(child, category, min(level + 1, 3))

    for node in CATEGORY_TREE:
        add_node(node)
    return created


def create_users(db, total: int = 540) -> list[User]:
    users = [
        User(
            username="customer_test",
            email="customer@example.com",
            password_hash=hash_password("password"),
            role=Role.CUSTOMER,
            is_verified=True,
            membership_tier=MembershipTier.GOLD,
            city="Shanghai",
            province="Shanghai",
            phone="13800000000",
        ),
        User(
            username="sales_test",
            email="sales@example.com",
            password_hash=hash_password("password"),
            role=Role.SALES,
            is_verified=True,
            membership_tier=MembershipTier.SILVER,
            city="Shenzhen",
            province="Guangdong",
        ),
        User(
            username="admin_test",
            email="admin@example.com",
            password_hash=hash_password("password"),
            role=Role.ADMIN,
            is_verified=True,
            membership_tier=MembershipTier.PLATINUM,
            city="Beijing",
            province="Beijing",
        ),
        User(
            username="customer_vip",
            email="vip@example.com",
            password_hash=hash_password("password"),
            role=Role.CUSTOMER,
            is_verified=True,
            membership_tier=MembershipTier.PLATINUM,
            city="Hangzhou",
            province="Zhejiang",
        ),
    ]

    tiers = [MembershipTier.BRONZE, MembershipTier.SILVER, MembershipTier.GOLD, MembershipTier.PLATINUM]
    tier_weights = [0.48, 0.28, 0.18, 0.06]
    for index in range(total - len(users)):
        is_cn = random.random() < 0.72
        fake = fake_cn if is_cn else fake_en
        province, city = random_city()
        username = f"user_{index + 1:04d}"
        created_at = recent_datetime()
        preferred = random.sample(["Electronics", "Clothing", "Sports", "Beauty", "Home", "Books"], k=3)
        user = User(
            username=username,
            email=f"{username}@example.com",
            password_hash=hash_password("password"),
            role=Role.CUSTOMER,
            is_verified=random.random() < 0.94,
            avatar_url=f"https://api.dicebear.com/7.x/initials/svg?seed={username}",
            phone=fake.phone_number()[:20],
            birth_date=fake.date_of_birth(minimum_age=18, maximum_age=55),
            membership_tier=random.choices(tiers, weights=tier_weights, k=1)[0],
            preferred_categories_json=preferred,
            city=city,
            province=province,
            created_at=created_at,
        )
        users.append(user)
    db.add_all(users)
    db.flush()

    for user in users:
        address_count = 1 if random.random() < 0.78 else 2
        for index in range(address_count):
            fake = fake_cn if user.city not in {"New York", "San Francisco"} else fake_en
            db.add(
                UserAddress(
                    user_id=user.id,
                    contact_name=fake.name(),
                    phone=user.phone or fake.phone_number()[:20],
                    province=user.province,
                    city=user.city,
                    district=fake.district() if hasattr(fake, "district") else "Central",
                    address_line=fake.street_address()[:200],
                    postal_code=fake.postcode(),
                    is_default=index == 0,
                )
            )
    return users


def create_products(db, categories: list[Category], total: int = 240) -> list[Product]:
    top_level = [category for category in categories if category.level == 1]
    brand_map = {
        "Electronics": ["NovaTech", "ByteWave", "Aster", "Pulse"],
        "Clothing": ["North Ridge", "Urban Flow", "Mori", "Eclat"],
        "Food": ["Harvest Lane", "Daily Bean", "FreshDock"],
        "Books": ["Insight Press", "Scholar Works", "North Leaf"],
        "Home": ["CasaForm", "Luma Nest", "Oakline"],
        "Sports": ["PeakMotion", "StrideUp", "VeloCore"],
        "Beauty": ["Velvet Dew", "PureMuse", "Bloom Lab"],
    }
    products: list[Product] = []
    for index in range(total):
        category = random.choice(top_level)
        category_name = category.name.split(" / ")[0]
        brand = random.choice(brand_map.get(category_name, ["Generic"]))
        price_base = {
            "Electronics": (199, 4999),
            "Clothing": (69, 899),
            "Food": (15, 199),
            "Books": (25, 188),
            "Home": (59, 1499),
            "Sports": (49, 1899),
            "Beauty": (39, 699),
        }.get(category_name, (30, 500))
        price = round(random.uniform(*price_base), 2)
        stock_quantity = random.randint(12, 320)
        provisional_seed = CATEGORY_IMAGE_OFFSETS.get(category_name, 0) + index + 1
        product = Product(
            category_id=category.id,
            name=f"{brand} {category_name} Item {index + 1}",
            sku=f"SKU-{category.id}-{index + 1:04d}",
            brand=brand,
            description=f"{brand} {category_name.lower()} product designed for analytics-rich e-commerce demos.",
            price=price,
            stock_quantity=stock_quantity,
            safety_stock=random.randint(8, 20),
            supplier_name=f"{brand} Supply Chain",
            base_weight=round(random.uniform(0.2, 8.0), 2),
            image_url=f"https://picsum.photos/seed/{provisional_seed}/800/800",
            thumbnail_url=f"https://picsum.photos/seed/{provisional_seed}/400/400",
            image_urls=[f"https://picsum.photos/seed/{provisional_seed + offset}/800/800" for offset in range(3)],
            gallery_json=[f"https://picsum.photos/seed/{provisional_seed + offset}/800/800" for offset in range(3)],
            tags_json=random.sample(PRODUCT_TAGS, k=random.randint(2, 4)),
            created_at=recent_datetime(),
            updated_at=recent_datetime(),
        )
        db.add(product)
        db.flush()
        image_payload = get_product_image_urls(product.id, category_name)
        product.image_url = image_payload["image_url"]
        product.thumbnail_url = image_payload["thumbnail_url"]
        if not product.image_url:
            product.image_url = f"https://picsum.photos/seed/generic{product.id}/800/800"
        if not product.thumbnail_url:
            product.thumbnail_url = f"https://picsum.photos/seed/generic{product.id}/400/400"
        image_urls = [
            product.image_url,
            f"https://picsum.photos/seed/{CATEGORY_IMAGE_OFFSETS.get(category_name, 0) + product.id + 1}/800/800",
            f"https://picsum.photos/seed/{CATEGORY_IMAGE_OFFSETS.get(category_name, 0) + product.id + 2}/800/800",
        ]
        product.image_urls = image_urls
        product.gallery_json = image_urls
        products.append(product)

        variant_count = random.randint(2, 4)
        colors = ["Black", "White", "Blue", "Red", "Green", "Pink"]
        sizes = ["S", "M", "L", "XL", "One Size"]
        for variant_index in range(variant_count):
            db.add(
                ProductVariant(
                    product_id=product.id,
                    sku=f"{product.sku}-V{variant_index + 1}",
                    color=random.choice(colors),
                    size=random.choice(sizes),
                    weight=max(0.1, round(product.base_weight + random.uniform(-0.2, 0.4), 2)),
                    stock_quantity=max(3, stock_quantity // variant_count + random.randint(-5, 8)),
                    image_url=product.image_urls[min(variant_index, len(product.image_urls) - 1)],
                    extra_images_json=product.image_urls[:2],
                    is_default=variant_index == 0,
                )
            )

        db.add(
            InventoryLog(
                product_id=product.id,
                change_type=InventoryChangeType.STOCK_IN,
                quantity_delta=stock_quantity,
                stock_after=stock_quantity,
                supplier_name=product.supplier_name,
                note="Initial stock import",
                operator_account="system",
                created_at=product.created_at,
            )
        )
    return products


def create_coupons(db, categories: list[Category]) -> list[Coupon]:
    coupons = [
        Coupon(code="WELCOME10", name="New User 10% Off", discount_type="percentage", discount_value=10, minimum_spend=99, usage_limit=1000),
        Coupon(code="DOUBLE11", name="Double 11 Mega Sale", discount_type="percentage", discount_value=15, minimum_spend=199, usage_limit=5000),
        Coupon(code="HOME50", name="Home Category 50 Off", discount_type="flat", discount_value=50, minimum_spend=399, usage_limit=500),
    ]
    for coupon in coupons:
        coupon.expires_at = datetime.utcnow() + timedelta(days=random.randint(30, 180))
        db.add(coupon)
    db.flush()

    customer_ids = [user.id for user in db.query(User).filter(User.role == Role.CUSTOMER).all()]
    for user_id in random.sample(customer_ids, k=min(len(customer_ids), 260)):
        db.add(UserCoupon(user_id=user_id, coupon_id=random.choice(coupons).id))
    return coupons


def create_reviews(db, users: list[User], products: list[Product], total: int = 820) -> None:
    customers = [user for user in users if user.role == Role.CUSTOMER]
    rating_weights = [0.08, 0.07, 0.25, 0.32, 0.28]
    for _ in range(total):
        user = random.choice(customers)
        product = random.choice(products)
        rating = random.choices([1, 2, 3, 4, 5], weights=rating_weights, k=1)[0]
        review = ProductReview(
            product_id=product.id,
            user_id=user.id,
            rating=rating,
            title=f"{['Poor', 'Below Average', 'Fair', 'Great', 'Excellent'][rating - 1]} experience",
            content=fake_cn.sentence(nb_words=18) if random.random() < 0.7 else fake_en.sentence(nb_words=18),
            review_images_json=[f"https://example.com/reviews/{uuid.uuid4().hex[:8]}.jpg"] if random.random() < 0.22 else [],
            verified_purchase=random.random() < 0.84,
            helpful_votes=random.randint(0, 48),
            created_at=recent_datetime(),
        )
        db.add(review)


def create_orders_and_events(db, users: list[User], products: list[Product], total_orders: int = 2200) -> None:
    customers = [user for user in users if user.role == Role.CUSTOMER]
    category_lookup = {product.id: product.category.name for product in products}
    coupon_codes = [coupon.code for coupon in db.query(Coupon).all()]

    for _ in range(total_orders):
        user = random.choice(customers)
        order_time = recent_datetime()
        month_bias = seasonal_category_bias(order_time.month)
        candidate_products = products[:]
        weighted_products = []
        for product in candidate_products:
            top_category = product.category.name.split(" / ")[0]
            weight = month_bias.get(top_category, 1.0)
            weighted_products.append(weight)
        product_count = random.choices([1, 2, 3, 4], weights=[0.38, 0.33, 0.20, 0.09], k=1)[0]
        selected_products = random.choices(candidate_products, weights=weighted_products, k=product_count)

        discount_amount = 0.0
        coupon_code = ""
        if user.city not in {city for _, city in TIER_1_CITIES} and random.random() < 0.42:
            coupon_code = random.choice(coupon_codes)

        order = Order(
            customer_id=user.id,
            status=random.choices(
                [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.COMPLETED],
                weights=[0.10, 0.14, 0.22, 0.26, 0.28],
                k=1,
            )[0],
            shipping_address=f"{user.province} {user.city} {fake_cn.street_address()}",
            payment_reference=f"PAY-{uuid.uuid4().hex[:12]}",
            payment_method=random.choice(PAYMENT_METHODS),
            delivery_fee=random.choice([0, 8, 12]),
            coupon_code=coupon_code,
            created_at=order_time,
            completed_at=order_time + timedelta(days=random.randint(2, 12)),
        )
        db.add(order)
        db.flush()

        total_amount = 0.0
        for product in selected_products:
            quantity = random.choices([1, 2, 3], weights=[0.72, 0.21, 0.07], k=1)[0]
            variant = random.choice(product.variants) if product.variants else None
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                variant_id=variant.id if variant else None,
                quantity=quantity,
                unit_price=product.price,
            )
            db.add(order_item)
            total_amount += product.price * quantity

            product.stock_quantity = max(product.stock_quantity - quantity, 0)
            if variant:
                variant.stock_quantity = max(variant.stock_quantity - quantity, 0)
            db.add(
                InventoryLog(
                    product_id=product.id,
                    change_type=InventoryChangeType.STOCK_OUT,
                    quantity_delta=-quantity,
                    stock_after=product.stock_quantity,
                    supplier_name=product.supplier_name,
                    note=f"Order #{order.id}",
                    operator_account=user.username,
                    created_at=order_time,
                )
            )
            db.add(
                EventLog(
                    user_id=user.id,
                    account=user.username,
                    event_type=EventType.PURCHASE,
                    ip_address=fake_cn.ipv4(),
                    session_id=uuid.uuid4().hex[:16],
                    device_type=random.choice(["mobile", "desktop", "tablet"]),
                    referrer_source=random.choice(["direct", "wechat", "douyin", "xiaohongshu", "search"]),
                    landing_page=f"/products/{product.id}",
                    bounce_flag=False,
                    category_name=category_lookup[product.id],
                    content=f"Purchased {product.name}",
                    amount=product.price * quantity,
                    metadata_json={"product_id": product.id, "quantity": quantity},
                    created_at=order_time,
                )
            )

        if coupon_code:
            discount_amount = round(total_amount * random.uniform(0.08, 0.15), 2)
        order.discount_amount = discount_amount
        order.total_amount = round(total_amount - discount_amount + order.delivery_fee, 2)

        db.add_all(
            [
                OrderTimeline(order_id=order.id, status=OrderStatus.PAID, operator_account=user.username, note="Order paid", created_at=order_time),
                OrderTimeline(order_id=order.id, status=OrderStatus.PROCESSING, operator_account="system", note="Picking started", created_at=order_time + timedelta(hours=4)),
                OrderTimeline(order_id=order.id, status=OrderStatus.SHIPPED, operator_account="system", note="Handed to courier", created_at=order_time + timedelta(days=1)),
                OrderTimeline(order_id=order.id, status=order.status, operator_account="system", note="Current order status", created_at=order_time + timedelta(days=2)),
                PaymentRecord(order_id=order.id, payment_method=order.payment_method, transaction_id=f"TXN-{uuid.uuid4().hex[:14]}", amount=order.total_amount, status=PaymentStatus.SUCCESS, paid_at=order_time),
                ShippingTracking(order_id=order.id, status_label="Package accepted", location="Shenzhen", note="Shipment accepted", created_at=order_time + timedelta(days=1)),
                ShippingTracking(order_id=order.id, status_label="Regional hub", location=user.city, note="Arrived at destination hub", created_at=order_time + timedelta(days=2)),
            ]
        )

    cart_events = 3000
    for index in range(10000):
        user = random.choice(customers)
        product = random.choice(products)
        created_at = recent_datetime()
        dwell = int(np.clip(np.random.gamma(shape=2.4, scale=35), 5, 300))
        bounced = random.random() < 0.18
        session_key = uuid.uuid4().hex[:18]
        db.add(
            UserBehaviorSession(
                user_id=user.id,
                session_key=session_key,
                device_type=random.choice(["mobile", "desktop", "tablet"]),
                browser=random.choice(["Chrome", "Safari", "Edge", "WeChat"]),
                referrer_source=random.choice(["direct", "search", "wechat", "douyin", "ad"]),
                landing_page=f"/products/{product.id}",
                bounce_flag=bounced,
                started_at=created_at,
                ended_at=created_at + timedelta(seconds=dwell),
            )
        )
        db.add(
            EventLog(
                user_id=user.id,
                account=user.username,
                event_type=EventType.BROWSE,
                ip_address=fake_cn.ipv4(),
                session_id=session_key,
                device_type=random.choice(["mobile", "desktop", "tablet"]),
                referrer_source=random.choice(["direct", "search", "wechat", "douyin", "ad"]),
                landing_page=f"/products/{product.id}",
                bounce_flag=bounced,
                category_name=product.category.name,
                content=f"Viewed product {product.name}",
                dwell_seconds=dwell,
                amount=0,
                metadata_json={"product_id": product.id, "region": user.city},
                created_at=created_at,
            )
        )
        if index < cart_events:
            abandoned = random.random() < 0.70
            db.add(
                EventLog(
                    user_id=user.id,
                    account=user.username,
                    event_type=EventType.CART,
                    ip_address=fake_cn.ipv4(),
                    session_id=session_key,
                    device_type="mobile",
                    referrer_source="search",
                    landing_page="/cart",
                    bounce_flag=abandoned,
                    category_name=product.category.name,
                    content="Cart add" if not abandoned else "Cart abandon before checkout",
                    dwell_seconds=random.randint(8, 90),
                    metadata_json={"product_id": product.id, "abandoned": abandoned},
                    created_at=created_at + timedelta(minutes=5),
                )
            )

    for _ in range(2000):
        user = random.choice(customers)
        keyword = random.choice(SEARCH_TERMS)
        result_count = max(0, int(np.random.normal(8, 4)))
        clicked = random.choice(products) if result_count > 0 and random.random() < 0.76 else None
        created_at = recent_datetime()
        db.add(
            SearchLog(
                user_id=user.id,
                keyword=keyword,
                result_count=result_count,
                clicked_product_id=clicked.id if clicked else None,
                click_position=random.randint(1, min(result_count, 10)) if clicked else None,
                zero_result=result_count == 0,
                created_at=created_at,
            )
        )
        db.add(
            EventLog(
                user_id=user.id,
                account=user.username,
                event_type=EventType.SEARCH,
                ip_address=fake_cn.ipv4(),
                session_id=uuid.uuid4().hex[:16],
                device_type=random.choice(["mobile", "desktop"]),
                referrer_source="search",
                landing_page="/search",
                bounce_flag=result_count == 0,
                category_name="",
                content=f"Searched for {keyword}",
                metadata_json={"keyword": keyword, "results": result_count},
                created_at=created_at,
            )
        )

    for user in random.sample(customers, k=min(len(customers), 240)):
        for product in random.sample(products, k=random.randint(1, 5)):
            db.add(WishlistItem(user_id=user.id, product_id=product.id, price_drop_alert=random.random() < 0.62))


def create_marketing_and_ops(db, products: list[Product]) -> None:
    banners = [
        Banner(title="618 Mid-Year Sale", subtitle="Big discounts on electronics and home", image_url="https://example.com/banner-618.jpg", target_url="/campaign/618", status=BannerStatus.ACTIVE),
        Banner(title="Double 11 Warmup", subtitle="Trending products with live demand", image_url="https://example.com/banner-1111.jpg", target_url="/campaign/double11", status=BannerStatus.ACTIVE),
        Banner(title="Member Day", subtitle="Exclusive coupons for Gold and Platinum", image_url="https://example.com/banner-member.jpg", target_url="/membership", status=BannerStatus.ACTIVE),
    ]
    for banner in banners:
        banner.click_count = random.randint(180, 1200)
        banner.start_at = recent_datetime()
        banner.end_at = banner.start_at + timedelta(days=30)
        db.add(banner)

    top_terms = Counter(random.choice(SEARCH_TERMS) for _ in range(400))
    for rank, (keyword, count) in enumerate(top_terms.most_common(12), start=1):
        db.add(HotSearchTrend(keyword=keyword, rank=rank, search_count=count, window_label="hourly"))

    for recipient in ["customer@example.com", "vip@example.com", "sales@example.com"]:
        db.add(
            EmailLog(
                recipient=recipient,
                template_name=random.choice(["order_confirmation", "shipping_notice", "abandoned_cart", "low_stock_alert"]),
                subject="Mock notification",
                payload_json={"status": "sent"},
                status="sent",
                created_at=recent_datetime(),
            )
        )

    for product in random.sample(products, k=18):
        db.add(
            SuspiciousActivity(
                ip_address=fake_cn.ipv4(),
                account="anonymous",
                reason=random.choice(["rapid sequential page views", "missing headers", "honeypot field triggered"]),
                risk_level=random.choice(["medium", "high"]),
                metadata_json={"product_id": product.id},
                created_at=recent_datetime(),
            )
        )


def create_recommendation_cache(db) -> None:
    customer_ids = [user.id for user in db.query(User).filter(User.role == Role.CUSTOMER).limit(80).all()]
    products = db.query(Product).limit(30).all()
    for user_id in customer_ids:
        picks = random.sample(products, k=6)
        db.add(
            RecommendationCache(
                user_id=user_id,
                recommendations_json=[
                    {
                        "product_id": product.id,
                        "product_name": product.name,
                        "score": round(random.uniform(1.2, 9.8), 3),
                        "reason": random.choice(["collaborative_filtering", "content_based", "business_rule"]),
                        "category_name": product.category.name,
                        "image_url": product.image_url,
                        "thumbnail_url": product.thumbnail_url,
                    }
                    for product in picks
                ],
                generated_at=recent_datetime(),
            )
        )


def create_daily_stats(db) -> None:
    end_day = date.today()
    for offset in range(30):
        stat_day = end_day - timedelta(days=offset)
        multiplier = 1.0 + (0.35 if stat_day.weekday() >= 5 else 0)
        db.add(
            DailyStat(
                stat_date=stat_day,
                revenue=round(random.uniform(18000, 62000) * multiplier, 2),
                orders_count=int(random.uniform(40, 160) * multiplier),
                new_users=random.randint(8, 35),
                active_users=random.randint(120, 420),
                browse_events=random.randint(280, 980),
                cart_events=random.randint(90, 260),
                search_events=random.randint(60, 220),
                generated_at=datetime.utcnow(),
            )
        )


def seed_enhanced() -> None:
    create_all_and_migrate()
    db = SessionLocal()
    try:
        for model in [
            RecommendationCache,
            SuspiciousActivity,
            EmailLog,
            DailyStat,
            HotSearchTrend,
            SearchLog,
            Banner,
            ShippingTracking,
            PaymentRecord,
            OrderTimeline,
            OrderItem,
            Order,
            WishlistItem,
            UserBehaviorSession,
            UserCoupon,
            Coupon,
            InventoryLog,
            ProductReview,
            ProductVariant,
            Product,
            Category,
            UserAddress,
            EventLog,
            User,
        ]:
            db.query(model).delete()
        db.commit()

        users = create_users(db)
        categories = create_categories(db)
        products = create_products(db, categories)
        create_coupons(db, categories)
        create_reviews(db, users, products)
        create_orders_and_events(db, users, products)
        create_marketing_and_ops(db, products)
        create_recommendation_cache(db)
        create_daily_stats(db)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_enhanced()
