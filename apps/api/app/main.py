import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.security import require_subscription
from app.core.security_middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.routers import auth, projects, datasets, analysis, reports, ws, billing


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Run migrations on startup for real deployments (skip for SQLite used in tests)
    if "sqlite" not in settings.DATABASE_URL:
        app_root = Path(__file__).parent.parent  # directory containing alembic.ini
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            check=True,
            cwd=app_root,
        )
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
app.include_router(projects.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)
app.include_router(datasets.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)
app.include_router(analysis.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)
app.include_router(reports.router, prefix=settings.API_V1_PREFIX, dependencies=_sub)


@app.get("/api/health")
@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy"}
