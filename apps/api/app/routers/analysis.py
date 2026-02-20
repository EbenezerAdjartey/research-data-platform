import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db, async_session as async_session_factory
from app.core.security import get_current_user
from app.models.user import User
from app.models.dataset import Dataset
from app.models.analysis import AnalysisResult
from app.models.visualization import Visualization
from app.schemas.analysis import (
    AnalysisRequest, AnalysisResponse,
    VisualizationCreate, VisualizationResponse,
)
from app.services.analysis.engine import run_analysis

router = APIRouter(prefix="/analysis", tags=["analysis"])


async def _run_analysis_background(analysis_id: int, analysis_type: str, parameters: dict, data_path: str, project_id: int):
    """Run analysis in background and update the database when done."""
    from app.routers.ws import broadcast_to_project

    await broadcast_to_project(project_id, {
        "type": "analysis_status",
        "analysis_id": analysis_id,
        "status": "running",
    })

    async with async_session_factory() as db:
        result_row = await db.execute(
            select(AnalysisResult).where(AnalysisResult.id == analysis_id)
        )
        analysis = result_row.scalar_one()

        try:
            results = await asyncio.to_thread(
                run_analysis,
                analysis_type=analysis_type,
                parameters=parameters,
                data_path=data_path,
            )
            analysis.results = results
            analysis.status = "completed"
            analysis.completed_at = datetime.now(timezone.utc)
        except Exception as e:
            analysis.status = "failed"
            analysis.error_message = str(e)

        await db.commit()

        await broadcast_to_project(project_id, {
            "type": "analysis_status",
            "analysis_id": analysis_id,
            "status": analysis.status,
            "error_message": analysis.error_message,
        })


@router.post("/run", response_model=AnalysisResponse, status_code=201)
async def run_analysis_endpoint(
    data: AnalysisRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    async_mode: bool = Query(False, alias="async"),
):
    result = await db.execute(
        select(Dataset).where(Dataset.id == data.dataset_id, Dataset.project_id == data.project_id)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    analysis = AnalysisResult(
        dataset_id=data.dataset_id,
        project_id=data.project_id,
        analysis_type=data.analysis_type,
        parameters=data.parameters,
        status="pending" if async_mode else "running",
    )
    db.add(analysis)
    await db.flush()

    if async_mode:
        # Run in background, return immediately with pending status
        await db.commit()
        await db.refresh(analysis)
        background_tasks.add_task(
            _run_analysis_background,
            analysis.id,
            data.analysis_type,
            data.parameters,
            dataset.storage_path,
            data.project_id,
        )
        return analysis

    # Synchronous mode (default) - run in thread pool to avoid blocking event loop
    try:
        results = await asyncio.to_thread(
            run_analysis,
            analysis_type=data.analysis_type,
            parameters=data.parameters,
            data_path=dataset.storage_path,
        )
        analysis.results = results
        analysis.status = "completed"
        analysis.completed_at = datetime.now(timezone.utc)
    except Exception as e:
        analysis.status = "failed"
        analysis.error_message = str(e)

    await db.commit()
    await db.refresh(analysis)
    return analysis


@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis


@router.get("/project/{project_id}", response_model=list[AnalysisResponse])
async def list_analyses(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalysisResult)
        .where(AnalysisResult.project_id == project_id)
        .order_by(AnalysisResult.created_at.desc())
    )
    return result.scalars().all()


@router.post("/visualizations", response_model=VisualizationResponse, status_code=201)
async def create_visualization(
    data: VisualizationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.id == data.analysis_result_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis result not found")

    from app.services.visualization import create_plotly_chart
    plotly_json = create_plotly_chart(
        analysis.results, data.chart_type, data.config
    )

    viz = Visualization(
        analysis_result_id=data.analysis_result_id,
        chart_type=data.chart_type,
        plotly_json=plotly_json,
    )
    db.add(viz)
    await db.flush()
    await db.commit()
    await db.refresh(viz)
    return viz


@router.get("/visualizations/{viz_id}", response_model=VisualizationResponse)
async def get_visualization(
    viz_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Visualization).where(Visualization.id == viz_id)
    )
    viz = result.scalar_one_or_none()
    if not viz:
        raise HTTPException(status_code=404, detail="Visualization not found")
    return viz
