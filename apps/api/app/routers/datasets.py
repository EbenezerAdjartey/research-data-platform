import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import pandas as pd
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.project import Project
from app.models.dataset import Dataset
from app.schemas.dataset import DatasetResponse, DatasetPreview

router = APIRouter(prefix="/datasets", tags=["datasets"])

SUPPORTED_FORMATS = {".csv", ".xlsx", ".xls", ".sav", ".sas7bdat", ".dta"}


def read_file_to_dataframe(file_path: Path, ext: str) -> pd.DataFrame:
    if ext == ".csv":
        return pd.read_csv(file_path)
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(file_path)
    elif ext == ".sav":
        import pyreadstat
        df, _ = pyreadstat.read_sav(str(file_path))
        return df
    elif ext == ".sas7bdat":
        import pyreadstat
        df, _ = pyreadstat.read_sas7bdat(str(file_path))
        return df
    elif ext == ".dta":
        import pyreadstat
        df, _ = pyreadstat.read_dta(str(file_path))
        return df
    raise ValueError(f"Unsupported format: {ext}")


@router.post("/{project_id}/upload", response_model=DatasetResponse, status_code=201)
async def upload_dataset(
    project_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}")

    upload_dir = settings.UPLOAD_DIR / str(user.id) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = uuid.uuid4().hex
    original_path = upload_dir / f"{file_id}{ext}"
    parquet_path = upload_dir / f"{file_id}.parquet"

    content = await file.read()
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB.")
    original_path.write_bytes(content)

    try:
        df = read_file_to_dataframe(original_path, ext)
        df.to_parquet(parquet_path, index=False)
    except Exception as e:
        original_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

    column_metadata = {
        col: {"dtype": str(df[col].dtype), "null_count": int(df[col].isnull().sum())}
        for col in df.columns
    }

    dataset = Dataset(
        project_id=project_id,
        filename=file.filename,
        storage_path=str(parquet_path),
        format=ext.lstrip("."),
        row_count=len(df),
        col_count=len(df.columns),
        column_metadata=column_metadata,
    )
    db.add(dataset)
    await db.flush()
    return dataset


@router.get("/{project_id}", response_model=list[DatasetResponse])
async def list_datasets(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(Dataset).where(Dataset.project_id == project_id).order_by(Dataset.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{project_id}/{dataset_id}/preview", response_model=DatasetPreview)
async def preview_dataset(
    project_id: int,
    dataset_id: int,
    rows: int = Query(default=50, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.project_id == project_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = pd.read_parquet(dataset.storage_path)
    preview_df = df.head(rows)

    return DatasetPreview(
        columns=list(df.columns),
        dtypes={col: str(df[col].dtype) for col in df.columns},
        rows=preview_df.fillna("").to_dict(orient="records"),
        total_rows=len(df),
    )


@router.delete("/{project_id}/{dataset_id}", status_code=204)
async def delete_dataset(
    project_id: int,
    dataset_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.project_id == project_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    parquet_path = Path(dataset.storage_path)
    parquet_path.unlink(missing_ok=True)
    # Also remove the original uploaded file stored alongside the parquet
    original_path = parquet_path.with_suffix(f".{dataset.format}")
    original_path.unlink(missing_ok=True)
    await db.delete(dataset)
