from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.security_middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.routers import auth, projects, datasets, analysis, reports, ws

app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
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

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(projects.router, prefix=settings.API_V1_PREFIX)
app.include_router(datasets.router, prefix=settings.API_V1_PREFIX)
app.include_router(analysis.router, prefix=settings.API_V1_PREFIX)
app.include_router(reports.router, prefix=settings.API_V1_PREFIX)
app.include_router(ws.router, prefix=settings.API_V1_PREFIX)


@app.get("/api/health")
@app.get("/api/v1/health")
async def health_check():
    return {"status": "healthy"}
