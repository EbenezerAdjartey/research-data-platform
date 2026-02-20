"""
Comprehensive API test suite for the Research Data Platform.

Covers:
  - Auth: register, login, duplicate email, invalid credentials, token refresh,
    logout, profile retrieval, profile update, protected-route guard.
  - Projects: full CRUD lifecycle, ownership isolation, not-found handling.
  - Analysis: run (with mocked engine), get by id, list by project.

All tests use an in-memory SQLite database via the fixtures defined in
conftest.py so no external services are required.
"""

from unittest.mock import patch
import uuid
import pytest

from tests.conftest import auth_header


def _unique_email(prefix: str = "user") -> str:
    """Generate a unique email to avoid any cross-test or intra-test collisions."""
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"

# ---------------------------------------------------------------------------
# Prefix shorthand
# ---------------------------------------------------------------------------
AUTH = "/api/v1/auth"
PROJECTS = "/api/v1/projects"
ANALYSIS = "/api/v1/analysis"


# ============================================================================
#  AUTH TESTS
# ============================================================================
class TestAuthRegister:
    """Tests for POST /api/v1/auth/register"""

    @pytest.mark.asyncio
    async def test_register_success(self, client):
        """A valid registration returns 201 with access and refresh tokens."""
        response = await client.post(f"{AUTH}/register", json={
            "email": "newuser@example.com",
            "password": "SecurePass123",
            "full_name": "New User",
            "institution": "MIT",
        })
        assert response.status_code == 201
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_register_without_institution(self, client):
        """Institution is optional; registration should still succeed."""
        response = await client.post(f"{AUTH}/register", json={
            "email": "noinst@example.com",
            "password": "SecurePass123",
            "full_name": "No Institution",
        })
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client):
        """Registering with an already-used email returns 400."""
        payload = {
            "email": "dupe@example.com",
            "password": "SecurePass123",
            "full_name": "First User",
        }
        resp1 = await client.post(f"{AUTH}/register", json=payload)
        assert resp1.status_code == 201

        resp2 = await client.post(f"{AUTH}/register", json=payload)
        assert resp2.status_code == 400
        assert "already registered" in resp2.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client):
        """An invalid email format is rejected by Pydantic validation (422)."""
        response = await client.post(f"{AUTH}/register", json={
            "email": "not-an-email",
            "password": "SecurePass123",
            "full_name": "Bad Email",
        })
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_missing_required_fields(self, client):
        """Omitting required fields returns 422."""
        response = await client.post(f"{AUTH}/register", json={
            "email": "missing@example.com",
        })
        assert response.status_code == 422


class TestAuthLogin:
    """Tests for POST /api/v1/auth/login"""

    @pytest.mark.asyncio
    async def test_login_success(self, client):
        """A correct email/password pair returns 200 with tokens.

        We patch ``create_refresh_token`` on the login call to ensure the
        generated JWT differs from the one created during registration
        (same user + same second can produce an identical token otherwise).
        """
        email = _unique_email("login")
        await client.post(f"{AUTH}/register", json={
            "email": email,
            "password": "SecurePass123",
            "full_name": "Login User",
        })

        import uuid as _uuid

        def _unique_refresh(subject: str) -> str:
            """Wrapper that injects a jti to avoid hash collisions."""
            from datetime import datetime, timedelta, timezone
            from jose import jwt
            from app.core.config import settings
            expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            return jwt.encode(
                {"sub": subject, "exp": expire, "type": "refresh", "jti": _uuid.uuid4().hex},
                settings.SECRET_KEY,
                algorithm=settings.ALGORITHM,
            )

        with patch("app.routers.auth.create_refresh_token", side_effect=_unique_refresh):
            response = await client.post(f"{AUTH}/login", json={
                "email": email,
                "password": "SecurePass123",
            })
        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        """An incorrect password returns 401."""
        await client.post(f"{AUTH}/register", json={
            "email": "wrongpw@example.com",
            "password": "CorrectPass123",
            "full_name": "Wrong PW",
        })
        response = await client.post(f"{AUTH}/login", json={
            "email": "wrongpw@example.com",
            "password": "WrongPassword",
        })
        assert response.status_code == 401
        assert "invalid credentials" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client):
        """Logging in with an unregistered email returns 401."""
        response = await client.post(f"{AUTH}/login", json={
            "email": "ghost@example.com",
            "password": "whatever",
        })
        assert response.status_code == 401


class TestAuthTokenRefresh:
    """Tests for POST /api/v1/auth/refresh"""

    @pytest.mark.asyncio
    async def test_refresh_success(self, client):
        """A valid refresh token returns a new token pair."""
        reg = await client.post(f"{AUTH}/register", json={
            "email": _unique_email("refresh"),
            "password": "SecurePass123",
            "full_name": "Refresh User",
        })
        refresh_token = reg.json()["refresh_token"]

        # Patch to avoid token hash collision (new refresh token same second)
        from app.core.config import settings
        import uuid as _uuid
        from datetime import datetime, timedelta, timezone
        from jose import jwt

        def _unique_refresh(subject: str) -> str:
            expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            return jwt.encode(
                {"sub": subject, "exp": expire, "type": "refresh", "jti": _uuid.uuid4().hex},
                settings.SECRET_KEY,
                algorithm=settings.ALGORITHM,
            )

        with patch("app.routers.auth.create_refresh_token", side_effect=_unique_refresh):
            response = await client.post(f"{AUTH}/refresh", json={
                "refresh_token": refresh_token,
            })
        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body
        # The new refresh token should differ from the old one (rotation).
        assert body["refresh_token"] != refresh_token

    @pytest.mark.asyncio
    async def test_refresh_reuse_revoked_token(self, client):
        """Replaying an already-consumed refresh token returns 401."""
        reg = await client.post(f"{AUTH}/register", json={
            "email": _unique_email("reuse"),
            "password": "SecurePass123",
            "full_name": "Reuse User",
        })
        refresh_token = reg.json()["refresh_token"]

        from app.core.config import settings
        import uuid as _uuid
        from datetime import datetime, timedelta, timezone
        from jose import jwt

        def _unique_refresh(subject: str) -> str:
            expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            return jwt.encode(
                {"sub": subject, "exp": expire, "type": "refresh", "jti": _uuid.uuid4().hex},
                settings.SECRET_KEY,
                algorithm=settings.ALGORITHM,
            )

        # First refresh succeeds
        with patch("app.routers.auth.create_refresh_token", side_effect=_unique_refresh):
            resp1 = await client.post(f"{AUTH}/refresh", json={
                "refresh_token": refresh_token,
            })
        assert resp1.status_code == 200

        # Second refresh with the *same* old token should fail
        resp2 = await client.post(f"{AUTH}/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp2.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_invalid_token(self, client):
        """A garbage refresh token returns 401."""
        response = await client.post(f"{AUTH}/refresh", json={
            "refresh_token": "not.a.real.token",
        })
        assert response.status_code == 401


class TestAuthLogout:
    """Tests for POST /api/v1/auth/logout"""

    @pytest.mark.asyncio
    async def test_logout_success(self, authenticated_client):
        """Logout revokes the refresh token and returns 200."""
        client, access, refresh, _ = authenticated_client
        response = await client.post(
            f"{AUTH}/logout",
            json={"refresh_token": refresh},
            headers=auth_header(access),
        )
        assert response.status_code == 200
        assert response.json()["detail"] == "Logged out"

    @pytest.mark.asyncio
    async def test_logout_requires_auth(self, client):
        """Logout without an access token returns 401."""
        response = await client.post(f"{AUTH}/logout", json={
            "refresh_token": "doesnt-matter",
        })
        assert response.status_code == 401


class TestAuthProfile:
    """Tests for GET/PATCH /api/v1/auth/me"""

    @pytest.mark.asyncio
    async def test_get_profile(self, authenticated_client):
        """GET /me returns the current user's info."""
        client, token, _, user_data = authenticated_client
        response = await client.get(f"{AUTH}/me", headers=auth_header(token))
        assert response.status_code == 200
        body = response.json()
        assert body["email"] == user_data["email"]
        assert body["full_name"] == user_data["full_name"]
        assert body["institution"] == user_data["institution"]

    @pytest.mark.asyncio
    async def test_get_profile_unauthenticated(self, client):
        """GET /me without a token returns 401."""
        response = await client.get(f"{AUTH}/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_profile_invalid_token(self, client):
        """GET /me with an invalid token returns 401."""
        response = await client.get(
            f"{AUTH}/me", headers=auth_header("invalid.jwt.token")
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_update_profile_full_name(self, authenticated_client):
        """PATCH /me updates the user's full name."""
        client, token, _, _ = authenticated_client
        response = await client.patch(
            f"{AUTH}/me",
            json={"full_name": "Updated Name"},
            headers=auth_header(token),
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_profile_institution(self, authenticated_client):
        """PATCH /me updates the user's institution."""
        client, token, _, _ = authenticated_client
        response = await client.patch(
            f"{AUTH}/me",
            json={"institution": "Stanford"},
            headers=auth_header(token),
        )
        assert response.status_code == 200
        assert response.json()["institution"] == "Stanford"

    @pytest.mark.asyncio
    async def test_update_profile_unauthenticated(self, client):
        """PATCH /me without a token returns 401."""
        response = await client.patch(f"{AUTH}/me", json={"full_name": "X"})
        assert response.status_code == 401


# ============================================================================
#  PROJECT TESTS
# ============================================================================
class TestProjectsCRUD:
    """Tests for the /api/v1/projects endpoints."""

    @pytest.mark.asyncio
    async def test_create_project(self, authenticated_client):
        """POST /projects creates a project and returns 201."""
        client, token, _, _ = authenticated_client
        response = await client.post(
            f"{PROJECTS}/",
            json={"name": "My Research", "description": "A test project"},
            headers=auth_header(token),
        )
        assert response.status_code == 201
        body = response.json()
        assert body["name"] == "My Research"
        assert body["description"] == "A test project"
        assert "id" in body
        assert "created_at" in body
        assert "updated_at" in body

    @pytest.mark.asyncio
    async def test_create_project_minimal(self, authenticated_client):
        """A project can be created without a description."""
        client, token, _, _ = authenticated_client
        response = await client.post(
            f"{PROJECTS}/",
            json={"name": "Minimal Project"},
            headers=auth_header(token),
        )
        assert response.status_code == 201
        assert response.json()["description"] is None

    @pytest.mark.asyncio
    async def test_create_project_unauthenticated(self, client):
        """Creating a project without auth returns 401."""
        response = await client.post(
            f"{PROJECTS}/", json={"name": "No Auth"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_list_projects(self, authenticated_client):
        """GET /projects returns a list of the user's projects."""
        client, token, _, _ = authenticated_client
        # Create two projects
        await client.post(
            f"{PROJECTS}/",
            json={"name": "Project A"},
            headers=auth_header(token),
        )
        await client.post(
            f"{PROJECTS}/",
            json={"name": "Project B"},
            headers=auth_header(token),
        )
        response = await client.get(
            f"{PROJECTS}/", headers=auth_header(token),
        )
        assert response.status_code == 200
        projects = response.json()
        assert isinstance(projects, list)
        assert len(projects) >= 2
        names = [p["name"] for p in projects]
        assert "Project A" in names
        assert "Project B" in names

    @pytest.mark.asyncio
    async def test_get_project_by_id(self, authenticated_client):
        """GET /projects/{id} returns the requested project."""
        client, token, _, _ = authenticated_client
        create_resp = await client.post(
            f"{PROJECTS}/",
            json={"name": "Get By ID"},
            headers=auth_header(token),
        )
        project_id = create_resp.json()["id"]

        response = await client.get(
            f"{PROJECTS}/{project_id}", headers=auth_header(token),
        )
        assert response.status_code == 200
        assert response.json()["id"] == project_id
        assert response.json()["name"] == "Get By ID"

    @pytest.mark.asyncio
    async def test_get_project_not_found(self, authenticated_client):
        """GET /projects/{id} for a non-existent id returns 404."""
        client, token, _, _ = authenticated_client
        response = await client.get(
            f"{PROJECTS}/999999", headers=auth_header(token),
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_project(self, authenticated_client):
        """PATCH /projects/{id} updates name and description."""
        client, token, _, _ = authenticated_client
        create_resp = await client.post(
            f"{PROJECTS}/",
            json={"name": "Original Name", "description": "Old desc"},
            headers=auth_header(token),
        )
        project_id = create_resp.json()["id"]

        response = await client.patch(
            f"{PROJECTS}/{project_id}",
            json={"name": "New Name", "description": "New desc"},
            headers=auth_header(token),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "New Name"
        assert body["description"] == "New desc"

    @pytest.mark.asyncio
    async def test_update_project_partial(self, authenticated_client):
        """PATCH /projects/{id} with only name leaves description unchanged."""
        client, token, _, _ = authenticated_client
        create_resp = await client.post(
            f"{PROJECTS}/",
            json={"name": "Partial", "description": "Keep me"},
            headers=auth_header(token),
        )
        project_id = create_resp.json()["id"]

        response = await client.patch(
            f"{PROJECTS}/{project_id}",
            json={"name": "Partial Updated"},
            headers=auth_header(token),
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Partial Updated"
        assert response.json()["description"] == "Keep me"

    @pytest.mark.asyncio
    async def test_update_project_not_found(self, authenticated_client):
        """PATCH /projects/{id} for a non-existent id returns 404."""
        client, token, _, _ = authenticated_client
        response = await client.patch(
            f"{PROJECTS}/999999",
            json={"name": "Ghost"},
            headers=auth_header(token),
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_project(self, authenticated_client):
        """DELETE /projects/{id} removes the project (204) and a subsequent
        GET returns 404."""
        client, token, _, _ = authenticated_client
        create_resp = await client.post(
            f"{PROJECTS}/",
            json={"name": "Delete Me"},
            headers=auth_header(token),
        )
        project_id = create_resp.json()["id"]

        del_resp = await client.delete(
            f"{PROJECTS}/{project_id}", headers=auth_header(token),
        )
        assert del_resp.status_code == 204

        get_resp = await client.get(
            f"{PROJECTS}/{project_id}", headers=auth_header(token),
        )
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_project_not_found(self, authenticated_client):
        """DELETE /projects/{id} for a non-existent id returns 404."""
        client, token, _, _ = authenticated_client
        response = await client.delete(
            f"{PROJECTS}/999999", headers=auth_header(token),
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_project_isolation_between_users(self, client):
        """User B cannot see or access User A's projects."""
        # Register user A
        reg_a = await client.post(f"{AUTH}/register", json={
            "email": "usera@example.com",
            "password": "Pass123!",
            "full_name": "User A",
        })
        token_a = reg_a.json()["access_token"]

        # User A creates a project
        proj_resp = await client.post(
            f"{PROJECTS}/",
            json={"name": "A's Project"},
            headers=auth_header(token_a),
        )
        project_id = proj_resp.json()["id"]

        # Register user B
        reg_b = await client.post(f"{AUTH}/register", json={
            "email": "userb@example.com",
            "password": "Pass123!",
            "full_name": "User B",
        })
        token_b = reg_b.json()["access_token"]

        # User B cannot GET user A's project
        get_resp = await client.get(
            f"{PROJECTS}/{project_id}", headers=auth_header(token_b),
        )
        assert get_resp.status_code == 404

        # User B's project list should not include A's project
        list_resp = await client.get(
            f"{PROJECTS}/", headers=auth_header(token_b),
        )
        ids = [p["id"] for p in list_resp.json()]
        assert project_id not in ids


# ============================================================================
#  ANALYSIS TESTS (with mocked engine to avoid needing real data files)
# ============================================================================
class TestAnalysisEndpoints:
    """Tests for /api/v1/analysis endpoints.

    The ``run_analysis`` function is patched so we don't need actual parquet
    files or statistical libraries during testing.
    """

    async def _setup_project_and_dataset(self, client, token, db_session):
        """Helper: create a project and insert a dataset row directly so that
        the analysis endpoint can find them."""
        from app.models.dataset import Dataset

        # Create project via API
        proj_resp = await client.post(
            f"{PROJECTS}/",
            json={"name": "Analysis Project"},
            headers=auth_header(token),
        )
        project_id = proj_resp.json()["id"]

        # Insert a dataset row directly into the DB (avoids needing a real file upload)
        dataset = Dataset(
            project_id=project_id,
            filename="test_data.csv",
            storage_path="/tmp/fake_data.parquet",
            format="csv",
            row_count=100,
            col_count=5,
            column_metadata={"col1": {"dtype": "float64", "null_count": 0}},
        )
        db_session.add(dataset)
        await db_session.flush()

        return project_id, dataset.id

    @pytest.mark.asyncio
    async def test_run_analysis_sync(self, authenticated_client, db_session):
        """POST /analysis/run in synchronous mode returns completed results."""
        client, token, _, _ = authenticated_client
        project_id, dataset_id = await self._setup_project_and_dataset(
            client, token, db_session,
        )

        mock_results = {
            "mean": 42.0,
            "std": 3.14,
            "n": 100,
        }

        with patch(
            "app.routers.analysis.run_analysis",
            return_value=mock_results,
        ):
            response = await client.post(
                f"{ANALYSIS}/run",
                json={
                    "dataset_id": dataset_id,
                    "project_id": project_id,
                    "analysis_type": "descriptive",
                    "parameters": {"columns": ["col1"]},
                },
                headers=auth_header(token),
            )

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "completed"
        assert body["results"] == mock_results
        assert body["analysis_type"] == "descriptive"
        assert body["dataset_id"] == dataset_id
        assert body["project_id"] == project_id
        assert body["error_message"] is None

    @pytest.mark.asyncio
    async def test_run_analysis_failed(self, authenticated_client, db_session):
        """When the analysis engine raises, the result status is 'failed'."""
        client, token, _, _ = authenticated_client
        project_id, dataset_id = await self._setup_project_and_dataset(
            client, token, db_session,
        )

        with patch(
            "app.routers.analysis.run_analysis",
            side_effect=ValueError("Missing required column"),
        ):
            response = await client.post(
                f"{ANALYSIS}/run",
                json={
                    "dataset_id": dataset_id,
                    "project_id": project_id,
                    "analysis_type": "regression",
                    "parameters": {},
                },
                headers=auth_header(token),
            )

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "failed"
        assert "Missing required column" in body["error_message"]

    @pytest.mark.asyncio
    async def test_run_analysis_dataset_not_found(self, authenticated_client):
        """Requesting analysis on a non-existent dataset returns 404."""
        client, token, _, _ = authenticated_client
        response = await client.post(
            f"{ANALYSIS}/run",
            json={
                "dataset_id": 999999,
                "project_id": 999999,
                "analysis_type": "descriptive",
                "parameters": {},
            },
            headers=auth_header(token),
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_run_analysis_unauthenticated(self, client):
        """Running analysis without auth returns 401."""
        response = await client.post(
            f"{ANALYSIS}/run",
            json={
                "dataset_id": 1,
                "project_id": 1,
                "analysis_type": "descriptive",
                "parameters": {},
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_analysis_by_id(self, authenticated_client, db_session):
        """GET /analysis/{id} returns the analysis record."""
        client, token, _, _ = authenticated_client
        project_id, dataset_id = await self._setup_project_and_dataset(
            client, token, db_session,
        )

        mock_results = {"summary": "ok"}
        with patch(
            "app.routers.analysis.run_analysis",
            return_value=mock_results,
        ):
            create_resp = await client.post(
                f"{ANALYSIS}/run",
                json={
                    "dataset_id": dataset_id,
                    "project_id": project_id,
                    "analysis_type": "descriptive",
                    "parameters": {},
                },
                headers=auth_header(token),
            )
        analysis_id = create_resp.json()["id"]

        response = await client.get(
            f"{ANALYSIS}/{analysis_id}", headers=auth_header(token),
        )
        assert response.status_code == 200
        body = response.json()
        assert body["id"] == analysis_id
        assert body["results"] == mock_results

    @pytest.mark.asyncio
    async def test_get_analysis_not_found(self, authenticated_client):
        """GET /analysis/{id} for a missing id returns 404."""
        client, token, _, _ = authenticated_client
        response = await client.get(
            f"{ANALYSIS}/999999", headers=auth_header(token),
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_analyses_by_project(
        self, authenticated_client, db_session,
    ):
        """GET /analysis/project/{project_id} lists all analyses for a project."""
        client, token, _, _ = authenticated_client
        project_id, dataset_id = await self._setup_project_and_dataset(
            client, token, db_session,
        )

        with patch(
            "app.routers.analysis.run_analysis",
            return_value={"result": 1},
        ):
            await client.post(
                f"{ANALYSIS}/run",
                json={
                    "dataset_id": dataset_id,
                    "project_id": project_id,
                    "analysis_type": "descriptive",
                    "parameters": {},
                },
                headers=auth_header(token),
            )
            await client.post(
                f"{ANALYSIS}/run",
                json={
                    "dataset_id": dataset_id,
                    "project_id": project_id,
                    "analysis_type": "regression",
                    "parameters": {},
                },
                headers=auth_header(token),
            )

        response = await client.get(
            f"{ANALYSIS}/project/{project_id}", headers=auth_header(token),
        )
        assert response.status_code == 200
        analyses = response.json()
        assert isinstance(analyses, list)
        assert len(analyses) >= 2
        types = {a["analysis_type"] for a in analyses}
        assert "descriptive" in types
        assert "regression" in types

    @pytest.mark.asyncio
    async def test_list_analyses_empty_project(self, authenticated_client):
        """Listing analyses for a project with none returns an empty list."""
        client, token, _, _ = authenticated_client
        proj = await client.post(
            f"{PROJECTS}/",
            json={"name": "Empty Analyses"},
            headers=auth_header(token),
        )
        project_id = proj.json()["id"]

        response = await client.get(
            f"{ANALYSIS}/project/{project_id}", headers=auth_header(token),
        )
        assert response.status_code == 200
        assert response.json() == []


# ============================================================================
#  HEALTH CHECK
# ============================================================================
class TestHealthCheck:
    """Verify the health endpoint works independently of auth."""

    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
