from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import create_all_and_migrate
from .routers import admin, analytics, auth, orders, products, profile, recommendations, search

settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

create_all_and_migrate()

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(recommendations.router)
app.include_router(profile.router)
app.include_router(search.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}
