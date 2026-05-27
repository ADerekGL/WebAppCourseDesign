from __future__ import annotations

from .database import Base, SessionLocal, engine
from .models import Category, Product, Role, User
from .security import hash_password


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(User).first():
            db.add_all(
                [
                    User(
                        username="customer_test",
                        email="customer@example.com",
                        password_hash=hash_password("password"),
                        role=Role.CUSTOMER,
                        is_verified=True,
                    ),
                    User(
                        username="sales_test",
                        email="sales@example.com",
                        password_hash=hash_password("password"),
                        role=Role.SALES,
                        is_verified=True,
                    ),
                    User(
                        username="admin_test",
                        email="admin@example.com",
                        password_hash=hash_password("password"),
                        role=Role.ADMIN,
                        is_verified=True,
                    ),
                ]
            )

        if not db.query(Category).first():
            electronics = Category(name="Electronics", description="Devices and accessories")
            books = Category(name="Books", description="Technical and academic books")
            home = Category(name="Home", description="Home office essentials")
            db.add_all([electronics, books, home])
            db.flush()
            db.add_all(
                [
                    Product(category_id=electronics.id, name="Wireless Mouse", description="Ergonomic mouse", price=29.9, stock_quantity=120),
                    Product(category_id=electronics.id, name="Mechanical Keyboard", description="Hot-swappable keyboard", price=89.9, stock_quantity=64),
                    Product(category_id=books.id, name="Data Mining Handbook", description="Analytics reference", price=59.0, stock_quantity=25),
                    Product(category_id=home.id, name="Standing Desk Lamp", description="Adjustable desk lamp", price=39.5, stock_quantity=48),
                ]
            )

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
