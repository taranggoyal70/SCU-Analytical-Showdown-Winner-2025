"""
Application configuration for the optional FastAPI backend.

The production web app is the Next.js app at the repository root. This backend
uses the same committed CSV source of truth and does not depend on local
absolute paths.
"""

from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings


REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Runtime settings."""

    APP_NAME: str = "Nazava Analytics Backend"
    DEBUG: bool = False

    # Optional services retained for local experimentation. The active backend
    # endpoints do not require a database or Redis to serve analytics.
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/shopee_analytics"
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "replace-with-a-strong-production-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    DATA_PATH: str = str(REPO_ROOT / "data" / "cleaned")
    MODEL_PATH: str = str(REPO_ROOT / "ml" / "models")

    FORECAST_DAYS: int = 30
    CONFIDENCE_INTERVAL: float = 0.95

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
