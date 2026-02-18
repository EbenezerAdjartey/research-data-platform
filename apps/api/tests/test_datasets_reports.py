"""Tests for datasets, reports, and visualization endpoints."""
import io
import pytest
import pytest_asyncio
from httpx import AsyncClient
from unittest.mock import patch, MagicMock

from tests.conftest import auth_header


# ---------------------------------------------------------------------------
# Helper: create a project for the authenticated user
# ---------------------------------------------------------------------------
async def _create_project(client: AsyncClient, token: str) -> dict:
    res = await client.post(
        "/api/v1/projects/",
        json={"name": "Test Project", "description": "For testing"},
        headers=auth_header(token),
    )
    assert res.status_code == 201
    return res.json()


# ===========================================================================
# Dataset tests
# ===========================================================================
class TestDatasetUpload:
    @pytest.mark.asyncio
    async def test_upload_csv(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        csv_content = b"name,age,score\nAlice,30,85.5\nBob,25,92.0\nCharlie,35,78.3"
        files = {"file": ("test_data.csv", io.BytesIO(csv_content), "text/csv")}

        res = await client.post(
            f"/api/v1/datasets/{project['id']}/upload",
            files=files,
            headers=auth_header(token),
        )
        assert res.status_code == 201
        data = res.json()
        assert data["filename"] == "test_data.csv"
        assert data["format"] == "csv"
        assert data["row_count"] == 3
        assert data["col_count"] == 3
        assert "name" in data["column_metadata"]
        assert "age" in data["column_metadata"]

    @pytest.mark.asyncio
    async def test_upload_unsupported_format(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
        res = await client.post(
            f"/api/v1/datasets/{project['id']}/upload",
            files=files,
            headers=auth_header(token),
        )
        assert res.status_code == 400
        assert "Unsupported" in res.json()["detail"]

    @pytest.mark.asyncio
    async def test_upload_to_nonexistent_project(self, authenticated_client):
        client, token, _, _ = authenticated_client
        csv_content = b"a,b\n1,2"
        files = {"file": ("data.csv", io.BytesIO(csv_content), "text/csv")}
        res = await client.post(
            "/api/v1/datasets/99999/upload",
            files=files,
            headers=auth_header(token),
        )
        assert res.status_code == 404

    @pytest.mark.asyncio
    async def test_upload_unauthenticated(self, client):
        csv_content = b"a,b\n1,2"
        files = {"file": ("data.csv", io.BytesIO(csv_content), "text/csv")}
        res = await client.post("/api/v1/datasets/1/upload", files=files)
        assert res.status_code == 401


class TestDatasetList:
    @pytest.mark.asyncio
    async def test_list_datasets(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        # Upload a file first
        csv_content = b"x,y\n1,2\n3,4"
        files = {"file": ("list_test.csv", io.BytesIO(csv_content), "text/csv")}
        await client.post(
            f"/api/v1/datasets/{project['id']}/upload",
            files=files,
            headers=auth_header(token),
        )

        res = await client.get(
            f"/api/v1/datasets/{project['id']}",
            headers=auth_header(token),
        )
        assert res.status_code == 200
        datasets = res.json()
        assert len(datasets) >= 1
        assert datasets[0]["filename"] == "list_test.csv"

    @pytest.mark.asyncio
    async def test_list_datasets_empty_project(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        res = await client.get(
            f"/api/v1/datasets/{project['id']}",
            headers=auth_header(token),
        )
        assert res.status_code == 200
        assert res.json() == []


class TestDatasetPreview:
    @pytest.mark.asyncio
    async def test_preview_dataset(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        csv_content = b"col_a,col_b,col_c\n10,20,30\n40,50,60\n70,80,90"
        files = {"file": ("preview.csv", io.BytesIO(csv_content), "text/csv")}
        upload_res = await client.post(
            f"/api/v1/datasets/{project['id']}/upload",
            files=files,
            headers=auth_header(token),
        )
        ds_id = upload_res.json()["id"]

        res = await client.get(
            f"/api/v1/datasets/{project['id']}/{ds_id}/preview?rows=2",
            headers=auth_header(token),
        )
        assert res.status_code == 200
        preview = res.json()
        assert preview["columns"] == ["col_a", "col_b", "col_c"]
        assert len(preview["rows"]) == 2
        assert preview["total_rows"] == 3

    @pytest.mark.asyncio
    async def test_preview_nonexistent_dataset(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        res = await client.get(
            f"/api/v1/datasets/{project['id']}/99999/preview",
            headers=auth_header(token),
        )
        assert res.status_code == 404


class TestDatasetDelete:
    @pytest.mark.asyncio
    async def test_delete_dataset(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        csv_content = b"a,b\n1,2"
        files = {"file": ("delete_me.csv", io.BytesIO(csv_content), "text/csv")}
        upload_res = await client.post(
            f"/api/v1/datasets/{project['id']}/upload",
            files=files,
            headers=auth_header(token),
        )
        ds_id = upload_res.json()["id"]

        res = await client.delete(
            f"/api/v1/datasets/{project['id']}/{ds_id}",
            headers=auth_header(token),
        )
        assert res.status_code == 204

        # Verify it's gone
        list_res = await client.get(
            f"/api/v1/datasets/{project['id']}",
            headers=auth_header(token),
        )
        assert all(d["id"] != ds_id for d in list_res.json())


# ===========================================================================
# Report tests
# ===========================================================================
class TestReports:
    @pytest.mark.asyncio
    async def test_create_report_draft(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        res = await client.post(
            "/api/v1/reports/",
            json={
                "project_id": project["id"],
                "title": "Test Report",
                "sections": {
                    "Introduction": "This is the introduction.",
                    "Results": {"summary": "All tests passed."},
                },
            },
            headers=auth_header(token),
        )
        assert res.status_code == 201
        report = res.json()
        assert report["title"] == "Test Report"
        assert report["project_id"] == project["id"]
        assert "Introduction" in report["sections"]

    @pytest.mark.asyncio
    async def test_get_report(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        create_res = await client.post(
            "/api/v1/reports/",
            json={
                "project_id": project["id"],
                "title": "Get Test Report",
                "sections": {"Intro": "Hello"},
            },
            headers=auth_header(token),
        )
        report_id = create_res.json()["id"]

        res = await client.get(
            f"/api/v1/reports/{report_id}",
            headers=auth_header(token),
        )
        assert res.status_code == 200
        assert res.json()["title"] == "Get Test Report"

    @pytest.mark.asyncio
    async def test_get_nonexistent_report(self, authenticated_client):
        client, token, _, _ = authenticated_client
        res = await client.get(
            "/api/v1/reports/99999",
            headers=auth_header(token),
        )
        assert res.status_code == 404

    @pytest.mark.asyncio
    async def test_list_reports_by_project(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        # Create two reports
        for i in range(2):
            await client.post(
                "/api/v1/reports/",
                json={
                    "project_id": project["id"],
                    "title": f"Report {i}",
                    "sections": {"sec": f"content {i}"},
                },
                headers=auth_header(token),
            )

        res = await client.get(
            f"/api/v1/reports/project/{project['id']}",
            headers=auth_header(token),
        )
        assert res.status_code == 200
        reports = res.json()
        assert len(reports) == 2

    @pytest.mark.asyncio
    async def test_list_reports_empty(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        res = await client.get(
            f"/api/v1/reports/project/{project['id']}",
            headers=auth_header(token),
        )
        assert res.status_code == 200
        assert res.json() == []

    @pytest.mark.asyncio
    async def test_create_report_unauthenticated(self, client):
        res = await client.post(
            "/api/v1/reports/",
            json={
                "project_id": 1,
                "title": "Unauthorized Report",
                "sections": {},
            },
        )
        assert res.status_code == 401

    @pytest.mark.asyncio
    async def test_download_nonexistent_report(self, authenticated_client):
        client, token, _, _ = authenticated_client
        res = await client.get(
            "/api/v1/reports/99999/download",
            headers=auth_header(token),
        )
        assert res.status_code == 404


# ===========================================================================
# Visualization tests
# ===========================================================================
class TestVisualizations:
    @pytest.mark.asyncio
    async def test_create_visualization(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        # Upload dataset
        csv_content = b"x,y\n1,2\n3,4\n5,6"
        files = {"file": ("viz_data.csv", io.BytesIO(csv_content), "text/csv")}
        upload_res = await client.post(
            f"/api/v1/datasets/{project['id']}/upload",
            files=files,
            headers=auth_header(token),
        )
        ds_id = upload_res.json()["id"]

        # Run analysis (mocked)
        with patch("app.routers.analysis.run_analysis") as mock_run:
            mock_run.return_value = {"mean_x": 3.0, "mean_y": 4.0, "correlation": 1.0}
            analysis_res = await client.post(
                "/api/v1/analysis/run",
                json={
                    "dataset_id": ds_id,
                    "project_id": project["id"],
                    "analysis_type": "descriptive_statistics",
                    "parameters": {"columns": ["x", "y"]},
                },
                headers=auth_header(token),
            )
        analysis_id = analysis_res.json()["id"]

        # Create visualization (mock the chart creation)
        with patch("app.services.visualization.create_plotly_chart") as mock_chart:
            mock_chart.return_value = {"data": [{"type": "bar"}], "layout": {"title": "Test"}}

            res = await client.post(
                "/api/v1/analysis/visualizations",
                json={
                    "analysis_result_id": analysis_id,
                    "chart_type": "bar",
                    "config": {},
                },
                headers=auth_header(token),
            )

        assert res.status_code == 201
        viz = res.json()
        assert viz["chart_type"] == "bar"
        assert viz["analysis_result_id"] == analysis_id

    @pytest.mark.asyncio
    async def test_get_visualization(self, authenticated_client):
        client, token, _, _ = authenticated_client
        project = await _create_project(client, token)

        # Upload + analyze
        csv_content = b"a,b\n1,2\n3,4"
        files = {"file": ("viz2.csv", io.BytesIO(csv_content), "text/csv")}
        upload_res = await client.post(
            f"/api/v1/datasets/{project['id']}/upload",
            files=files,
            headers=auth_header(token),
        )
        ds_id = upload_res.json()["id"]

        with patch("app.routers.analysis.run_analysis") as mock_run:
            mock_run.return_value = {"mean": 2.5}
            analysis_res = await client.post(
                "/api/v1/analysis/run",
                json={
                    "dataset_id": ds_id,
                    "project_id": project["id"],
                    "analysis_type": "descriptive_statistics",
                    "parameters": {"columns": ["a"]},
                },
                headers=auth_header(token),
            )
        analysis_id = analysis_res.json()["id"]

        # Create viz
        with patch("app.services.visualization.create_plotly_chart") as mock_chart:
            mock_chart.return_value = {"data": [], "layout": {}}
            create_res = await client.post(
                "/api/v1/analysis/visualizations",
                json={
                    "analysis_result_id": analysis_id,
                    "chart_type": "scatter",
                    "config": {},
                },
                headers=auth_header(token),
            )
        viz_id = create_res.json()["id"]

        # Get it back
        res = await client.get(
            f"/api/v1/analysis/visualizations/{viz_id}",
            headers=auth_header(token),
        )
        assert res.status_code == 200
        assert res.json()["chart_type"] == "scatter"

    @pytest.mark.asyncio
    async def test_get_nonexistent_visualization(self, authenticated_client):
        client, token, _, _ = authenticated_client
        res = await client.get(
            "/api/v1/analysis/visualizations/99999",
            headers=auth_header(token),
        )
        assert res.status_code == 404

    @pytest.mark.asyncio
    async def test_create_visualization_invalid_analysis(self, authenticated_client):
        client, token, _, _ = authenticated_client
        res = await client.post(
            "/api/v1/analysis/visualizations",
            json={
                "analysis_result_id": 99999,
                "chart_type": "bar",
                "config": {},
            },
            headers=auth_header(token),
        )
        assert res.status_code == 404


# ===========================================================================
# WebSocket tests
# ===========================================================================
class TestWebSocket:
    @pytest.mark.asyncio
    async def test_websocket_connect_and_ping(self, db_session):
        """Test that WebSocket endpoint accepts connections and responds to ping."""
        from starlette.testclient import TestClient
        from app.core.database import get_db
        from app.main import app as fastapi_app
        from app.core.security_middleware import _request_counts
        _request_counts.clear()

        async def _override_get_db():
            try:
                yield db_session
                await db_session.commit()
            except Exception:
                await db_session.rollback()
                raise

        fastapi_app.dependency_overrides[get_db] = _override_get_db

        try:
            # Use Starlette's sync TestClient which supports WebSocket testing
            with TestClient(fastapi_app) as tc:
                with tc.websocket_connect("/api/v1/ws/projects/1") as ws:
                    ws.send_text("ping")
                    data = ws.receive_json()
                    assert data == {"type": "pong"}
        finally:
            fastapi_app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_websocket_broadcast(self, db_session):
        """Test that broadcast_to_project sends messages to connected clients."""
        from app.routers.ws import broadcast_to_project, _connections

        # Clean state
        _connections.clear()

        # broadcast_to_project with no connections should not error
        await broadcast_to_project(999, {"type": "test", "data": "hello"})
        # defaultdict may create empty set on access, that's fine
        assert len(_connections.get(999, set())) == 0
