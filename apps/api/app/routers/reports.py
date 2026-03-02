from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.report import Report
from app.schemas.analysis import ReportCreate, ReportResponse
from app.services import storage

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
        from pathlib import Path
        from app.services.report_export import export_report
        from app.core.config import settings
        try:
            content, mime = export_report(report, data.export_format)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Export failed: {e}")

        if storage.r2_configured():
            key = f"reports/{report.id}.{data.export_format}"
            report.file_path = storage.upload_bytes(content, key, mime)
        else:
            output_dir = Path("uploads/reports")
            output_dir.mkdir(parents=True, exist_ok=True)
            local_path = output_dir / f"report_{report.id}.{data.export_format}"
            local_path.write_bytes(content)
            report.file_path = str(local_path)

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

    file_path = report.file_path

    if storage.r2_configured() and file_path.startswith("r2:"):
        url = storage.get_presigned_url(file_path)
        return RedirectResponse(url)

    # Local-disk fallback
    return FileResponse(file_path, filename=f"{report.title}.{report.export_format}")


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
