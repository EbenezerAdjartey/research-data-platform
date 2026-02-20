from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.report import Report
from app.schemas.analysis import ReportCreate, ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/", response_model=ReportResponse, status_code=201)
async def create_report(
    data: ReportCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report = Report(
        project_id=data.project_id,
        title=data.title,
        sections=data.sections,
        export_format=data.export_format,
    )
    db.add(report)
    await db.flush()

    if data.export_format:
        from app.services.report_export import export_report
        try:
            file_path = export_report(report, data.export_format)
            report.file_path = str(file_path)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Export failed: {e}")

    await db.commit()
    await db.refresh(report)
    return report


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{report_id}/download")
async def download_report(
    report_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report or not report.file_path:
        raise HTTPException(status_code=404, detail="Report file not found")
    return FileResponse(report.file_path, filename=f"{report.title}.{report.export_format}")


@router.get("/project/{project_id}", response_model=list[ReportResponse])
async def list_reports(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report).where(Report.project_id == project_id).order_by(Report.created_at.desc())
    )
    return result.scalars().all()
