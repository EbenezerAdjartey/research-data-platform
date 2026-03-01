import asyncio
import logging
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.security import get_current_user, require_subscription
from app.core.security_middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.routers import auth, projects, datasets, analysis, reports, ws, billing, dashboard, ai

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Run migrations on startup for real deployments (skip for SQLite used in tests)
    if "sqlite" not in settings.DATABASE_URL:
        app_root = Path(__file__).parent.parent  # directory containing alembic.ini
        for attempt in range(1, 6):
            result = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                cwd=app_root,
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                logger.info("Alembic migrations applied successfully")
                break
            logger.warning("Alembic attempt %d/5 failed (exit %d): %s",
                           attempt, result.returncode, result.stderr.strip())
            if attempt < 5:
                await asyncio.sleep(5)
        else:
            logger.error("All alembic attempts failed — DB schema may be out of date")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Security middleware (order matters: outermost first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes — no subscription check
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(billing.router, prefix=settings.API_V1_PREFIX)
app.include_router(ws.router, prefix=settings.API_V1_PREFIX)

# Subscription-gated routes
_sub = [Depends(require_subscription)]
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)
app.include_router(projects.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)
app.include_router(datasets.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)
app.include_router(analysis.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)
app.include_router(reports.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)
app.include_router(ai.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)


@app.get("/api/health")
@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/v1/ai/status", dependencies=[Depends(get_current_user)])
async def ai_status():
    """Returns whether the AI feature is configured. Auth-required but not subscription-gated."""
    return {"configured": bool(settings.ANTHROPIC_API_KEY)}
