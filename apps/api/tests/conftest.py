"""
Shared test fixtures for the Research Data Platform API test suite.

Uses SQLite (aiosqlite) as the test database backend to avoid requiring
a running PostgreSQL instance during testing.
"""

import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app

# ---------------------------------------------------------------------------
# Database configuration
# ---------------------------------------------------------------------------
# Use an in-memory SQLite database for speed and isolation.  StaticPool keeps
# the same connection open for the whole test session so SQLite's in-memory
# database persists across calls.
TEST_DB_URL = "sqlite+aiosqlite://"


# ---------------------------------------------------------------------------
# Event loop (session-scoped so async fixtures can share it)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop for pytest-asyncio."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ---------------------------------------------------------------------------
# Engine (session-scoped)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture(scope="session")
async def engine():
    """Create an async engine pointing at the in-memory test database."""
    eng = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    yield eng
    await eng.dispose()


# ---------------------------------------------------------------------------
# Per-test: recreate all tables so every test starts with a clean slate.
# This approach works even when route handlers call explicit commit().
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def db_session(engine):
    """Yield a fresh database session.  Tables are dropped and recreated
    before each test so that prior test data never leaks."""
    # Recreate schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# HTTP test client (injects the test DB session via dependency override)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def client(db_session):
    """Provide an ``httpx.AsyncClient`` wired to the FastAPI app with the
    database dependency replaced by the test session.

    Also resets the in-memory rate limiter so tests are not affected by
    request counts from previous tests.
    """
    # Clear rate limiter state so tests don't hit 429
    from app.core.security_middleware import _request_counts
    _request_counts.clear()

    async def _override_get_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth helper -- returns (client, access_token, refresh_token, user_data)
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def authenticated_client(client: AsyncClient):
    """Register a fresh user and return a tuple of
    ``(client, access_token, refresh_token, user_payload)``
    so tests can immediately make authenticated requests."""
    user_payload = {
        "email": "testuser@example.com",
        "password": "StrongPassword1!",
        "full_name": "Test User",
        "institution": "Test University",
    }
    response = await client.post("/api/v1/auth/register", json=user_payload)
    assert response.status_code == 201, response.text
    tokens = response.json()
    return client, tokens["access_token"], tokens["refresh_token"], user_payload


def auth_header(token: str) -> dict[str, str]:
    """Convenience function to build an Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}
