from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.models.analysis import AnalysisResult

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Total projects
    res = await db.execute(
        select(func.count()).select_from(Project).where(Project.user_id == user.id)
    )
    total_projects = res.scalar_one()

    # Total datasets across all user projects
    res = await db.execute(
        select(func.count())
        .select_from(Dataset)
        .join(Project, Dataset.project_id == Project.id)
        .where(Project.user_id == user.id)
    )
    total_datasets = res.scalar_one()

    # Total analyses
    res = await db.execute(
        select(func.count())
        .select_from(AnalysisResult)
        .join(Project, AnalysisResult.project_id == Project.id)
        .where(Project.user_id == user.id)
    )
    total_analyses = res.scalar_one()

    # Recent 5 analyses (with project name)
    rows = await db.execute(
        select(
            AnalysisResult.id,
            AnalysisResult.analysis_type,
            AnalysisResult.status,
            AnalysisResult.created_at,
            AnalysisResult.project_id,
            Project.name.label("project_name"),
        )
        .join(Project, AnalysisResult.project_id == Project.id)
        .where(Project.user_id == user.id)
        .order_by(AnalysisResult.created_at.desc())
        .limit(5)
    )
    recent_analyses = [
        {
            "id": r.id,
            "analysis_type": r.analysis_type,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "project_id": r.project_id,
            "project_name": r.project_name,
        }
        for r in rows
    ]

    return {
        "total_projects": total_projects,
        "total_datasets": total_datasets,
        "total_analyses": total_analyses,
        "recent_analyses": recent_analyses,
    }
