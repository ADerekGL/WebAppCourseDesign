from __future__ import annotations

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


SQLITE_COLUMN_MIGRATIONS: dict[str, list[tuple[str, str]]] = {
    "users": [
        ("avatar_url", "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT ''"),
        ("phone", "ALTER TABLE users ADD COLUMN phone VARCHAR(40) DEFAULT ''"),
        ("birth_date", "ALTER TABLE users ADD COLUMN birth_date DATE"),
        ("membership_tier", "ALTER TABLE users ADD COLUMN membership_tier VARCHAR(20) DEFAULT 'BRONZE'"),
        ("preferred_categories_json", "ALTER TABLE users ADD COLUMN preferred_categories_json JSON DEFAULT '[]'"),
        ("city", "ALTER TABLE users ADD COLUMN city VARCHAR(100) DEFAULT ''"),
        ("province", "ALTER TABLE users ADD COLUMN province VARCHAR(100) DEFAULT ''"),
        ("last_login_at", "ALTER TABLE users ADD COLUMN last_login_at DATETIME"),
    ],
    "categories": [
        ("parent_id", "ALTER TABLE categories ADD COLUMN parent_id INTEGER"),
        ("slug", "ALTER TABLE categories ADD COLUMN slug VARCHAR(120) DEFAULT ''"),
        ("level", "ALTER TABLE categories ADD COLUMN level INTEGER DEFAULT 1"),
        ("banner_image_url", "ALTER TABLE categories ADD COLUMN banner_image_url VARCHAR(255) DEFAULT ''"),
        ("seo_title", "ALTER TABLE categories ADD COLUMN seo_title VARCHAR(160) DEFAULT ''"),
        ("seo_description", "ALTER TABLE categories ADD COLUMN seo_description VARCHAR(255) DEFAULT ''"),
    ],
    "products": [
        ("sku", "ALTER TABLE products ADD COLUMN sku VARCHAR(64) DEFAULT ''"),
        ("brand", "ALTER TABLE products ADD COLUMN brand VARCHAR(80) DEFAULT ''"),
        ("safety_stock", "ALTER TABLE products ADD COLUMN safety_stock INTEGER DEFAULT 10"),
        ("supplier_name", "ALTER TABLE products ADD COLUMN supplier_name VARCHAR(120) DEFAULT ''"),
        ("base_weight", "ALTER TABLE products ADD COLUMN base_weight FLOAT DEFAULT 0"),
        ("thumbnail_url", "ALTER TABLE products ADD COLUMN thumbnail_url VARCHAR(255)"),
        ("image_urls", "ALTER TABLE products ADD COLUMN image_urls JSON DEFAULT '[]'"),
        ("gallery_json", "ALTER TABLE products ADD COLUMN gallery_json JSON DEFAULT '[]'"),
        ("tags_json", "ALTER TABLE products ADD COLUMN tags_json JSON DEFAULT '[]'"),
    ],
    "orders": [
        ("payment_method", "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20) DEFAULT 'CARD'"),
        ("discount_amount", "ALTER TABLE orders ADD COLUMN discount_amount FLOAT DEFAULT 0"),
        ("delivery_fee", "ALTER TABLE orders ADD COLUMN delivery_fee FLOAT DEFAULT 0"),
        ("coupon_code", "ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) DEFAULT ''"),
        ("completed_at", "ALTER TABLE orders ADD COLUMN completed_at DATETIME"),
    ],
    "order_items": [
        ("variant_id", "ALTER TABLE order_items ADD COLUMN variant_id INTEGER"),
    ],
    "event_logs": [
        ("session_id", "ALTER TABLE event_logs ADD COLUMN session_id VARCHAR(80) DEFAULT ''"),
        ("device_type", "ALTER TABLE event_logs ADD COLUMN device_type VARCHAR(40) DEFAULT ''"),
        ("referrer_source", "ALTER TABLE event_logs ADD COLUMN referrer_source VARCHAR(120) DEFAULT ''"),
        ("landing_page", "ALTER TABLE event_logs ADD COLUMN landing_page VARCHAR(255) DEFAULT ''"),
        ("bounce_flag", "ALTER TABLE event_logs ADD COLUMN bounce_flag BOOLEAN DEFAULT 0"),
    ],
}


def create_all_and_migrate() -> None:
    Base.metadata.create_all(bind=engine)
    if not settings.database_url.startswith("sqlite"):
        return

    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, migrations in SQLITE_COLUMN_MIGRATIONS.items():
            if not inspector.has_table(table_name):
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, ddl in migrations:
                if column_name not in existing_columns:
                    connection.execute(text(ddl))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
