from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_name: str = "Smart Commerce Analytics"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 120
    database_url: str = "sqlite:///./smart_commerce.db"
    redis_url: str = "redis://localhost:6379/0"
    frontend_url: str = "http://localhost:5173"
    backend_cors_origins: List[str] = ["http://localhost:5173"]
    smtp_sender: str = "no-reply@example.com"
    smtp_host: str = "localhost"
    smtp_port: int = 1025

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_sqlite_url(cls, value: str) -> str:
        if isinstance(value, str) and value.startswith("sqlite:///./"):
            database_name = value.removeprefix("sqlite:///./")
            return f"sqlite:///{(BASE_DIR / database_name).resolve().as_posix()}"
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
