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
        """Normalize DB URLs for any provider (Render uses postgres:// or postgresql://)."""
        # Ensure async URL always uses asyncpg driver
        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
        elif self.DATABASE_URL.startswith("postgresql://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Ensure sync URL uses plain postgresql:// (for alembic / psycopg2)
        if self.DATABASE_URL_SYNC.startswith("postgres://"):
            self.DATABASE_URL_SYNC = self.DATABASE_URL_SYNC.replace("postgres://", "postgresql://", 1)
        elif self.DATABASE_URL_SYNC.startswith("postgresql+asyncpg://"):
            self.DATABASE_URL_SYNC = self.DATABASE_URL_SYNC.replace("postgresql+asyncpg://", "postgresql://", 1)
        # If DATABASE_URL_SYNC is still the localhost default, derive it from DATABASE_URL
        _default_sync = "postgresql://rdp_user:rdp_password@localhost:5432/research_data_platform"
        if self.DATABASE_URL_SYNC == _default_sync and "asyncpg" in self.DATABASE_URL:
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

    # AI
    ANTHROPIC_API_KEY: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    # Set to false to bypass subscription enforcement (keeps billing code intact)
    REQUIRE_SUBSCRIPTION: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
