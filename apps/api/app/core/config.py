from pydantic_settings import BaseSettings
from pydantic import model_validator
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "Research Data Platform"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rdp_user:rdp_password@localhost:5432/research_data_platform"
    DATABASE_URL_SYNC: str = "postgresql://rdp_user:rdp_password@localhost:5432/research_data_platform"

    @model_validator(mode="after")
    def fix_database_urls(self):
        """Normalize DB URLs for providers like Render that use postgres:// prefix."""
        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
        if self.DATABASE_URL_SYNC.startswith("postgres://"):
            self.DATABASE_URL_SYNC = self.DATABASE_URL_SYNC.replace("postgres://", "postgresql://", 1)
        # If only DATABASE_URL is set, derive the sync version
        if "asyncpg" in self.DATABASE_URL and self.DATABASE_URL_SYNC == "postgresql://rdp_user:rdp_password@localhost:5432/research_data_platform":
            self.DATABASE_URL_SYNC = self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
        return self

    # JWT
    SECRET_KEY: str = "dev-secret-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # File uploads
    UPLOAD_DIR: Path = Path("uploads")
    MAX_UPLOAD_SIZE_MB: int = 100

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Stripe (leave empty to disable subscription gating in development)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
