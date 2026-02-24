import uuid
import asyncio
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
from app.schemas.dataset import (
    DatasetResponse, DatasetPreview,
    UrlImportRequest, SampleImportRequest, SampleDatasetInfo,
)

router = APIRouter(prefix="/datasets", tags=["datasets"])

SUPPORTED_FORMATS = {".csv", ".xlsx", ".xls", ".sav", ".sas7bdat", ".dta"}

# ---------------------------------------------------------------------------
# Built-in open sample datasets (powered by plotly.express.data)
# ---------------------------------------------------------------------------
SAMPLE_DATASETS: dict[str, dict] = {
    "iris": {
        "name": "Iris Flowers",
        "description": "Classic 3-class flower dataset: sepal/petal dimensions for Setosa, Versicolor, Virginica.",
        "tags": ["classification", "biology"],
    },
    "tips": {
        "name": "Restaurant Tips",
        "description": "Tip amounts at a restaurant with day, time, party size, and demographic info.",
        "tags": ["regression", "correlation"],
    },
    "gapminder_2007": {
        "name": "Gapminder (2007)",
        "description": "Life expectancy, GDP per capita, and population for 142 countries in 2007.",
        "tags": ["economics", "global", "time-series"],
    },
    "wind": {
        "name": "Wind Speed",
        "description": "Wind speed measurements by direction and strength categories.",
        "tags": ["environment", "categorical"],
    },
    "election": {
        "name": "Montreal Election",
        "description": "Montreal 2013 mayoral election results by district with candidate vote shares.",
        "tags": ["political science", "spatial"],
    },
    "stocks": {
        "name": "Tech Stocks",
        "description": "Daily closing stock prices for GOOG, AAPL, AMZN, FB, NFLX, MSFT (2018–2019).",
        "tags": ["finance", "time-series"],
    },
    "carshare": {
        "name": "Car Share Trips",
        "description": "Car-share trip counts by city peak hour in Montreal.",
        "tags": ["transportation", "geospatial"],
    },
}


def _load_sample_df(sample_id: str) -> pd.DataFrame:
    import plotly.express as px

    loaders = {
        "iris": lambda: px.data.iris(),
        "tips": lambda: px.data.tips(),
        "gapminder_2007": lambda: px.data.gapminder().query("year == 2007").reset_index(drop=True),
        "wind": lambda: px.data.wind(),
        "election": lambda: px.data.election(),
        "stocks": lambda: px.data.stocks(),
        "carshare": lambda: px.data.carshare(),
    }
    if sample_id not in loaders:
        raise ValueError(f"Unknown sample dataset: {sample_id}")
    return loaders[sample_id]()


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


@router.get("/samples", response_model=list[SampleDatasetInfo])
async def list_sample_datasets(user: User = Depends(get_current_user)):
    """Return metadata for all built-in open sample datasets."""
    result = []
    for sid, meta in SAMPLE_DATASETS.items():
        try:
            df = await asyncio.to_thread(_load_sample_df, sid)
            rows, cols = len(df), len(df.columns)
        except Exception:
            rows, cols = 0, 0
        result.append(SampleDatasetInfo(
            id=sid,
            name=meta["name"],
            description=meta["description"],
            rows=rows,
            cols=cols,
            tags=meta["tags"],
        ))
    return result


@router.post("/{project_id}/import-sample", response_model=DatasetResponse, status_code=201)
async def import_sample_dataset(
    project_id: int,
    body: SampleImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a built-in sample dataset into a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    if body.sample_id not in SAMPLE_DATASETS:
        raise HTTPException(status_code=400, detail=f"Unknown sample dataset: {body.sample_id}")

    try:
        df = await asyncio.to_thread(_load_sample_df, body.sample_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load sample: {e}")

    upload_dir = settings.UPLOAD_DIR / str(user.id) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_id = uuid.uuid4().hex
    parquet_path = upload_dir / f"{file_id}.parquet"
    df.to_parquet(parquet_path, index=False)

    column_metadata = {
        col: {"dtype": str(df[col].dtype), "null_count": int(df[col].isnull().sum())}
        for col in df.columns
    }
    meta = SAMPLE_DATASETS[body.sample_id]
    dataset = Dataset(
        project_id=project_id,
        filename=f"{meta['name'].lower().replace(' ', '_')}.csv",
        storage_path=str(parquet_path),
        format="csv",
        row_count=len(df),
        col_count=len(df.columns),
        column_metadata=column_metadata,
    )
    db.add(dataset)
    await db.flush()
    return dataset


@router.post("/{project_id}/import-url", response_model=DatasetResponse, status_code=201)
async def import_from_url(
    project_id: int,
    body: UrlImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a CSV or JSON URL and import it as a dataset."""
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    url = body.url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    # Determine format from URL extension
    url_path = url.split("?")[0].lower()
    if url_path.endswith(".json") or url_path.endswith(".geojson"):
        fmt = "json"
    elif url_path.endswith(".xlsx") or url_path.endswith(".xls"):
        fmt = "xlsx"
    else:
        fmt = "csv"  # default assumption

    try:
        if fmt == "json":
            df = await asyncio.to_thread(pd.read_json, url)
        elif fmt == "xlsx":
            df = await asyncio.to_thread(pd.read_excel, url)
        else:
            df = await asyncio.to_thread(pd.read_csv, url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse data from URL: {e}")

    if df.empty:
        raise HTTPException(status_code=422, detail="The URL returned an empty dataset.")

    max_rows = 200_000
    if len(df) > max_rows:
        df = df.head(max_rows)

    upload_dir = settings.UPLOAD_DIR / str(user.id) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_id = uuid.uuid4().hex
    parquet_path = upload_dir / f"{file_id}.parquet"
    df.to_parquet(parquet_path, index=False)

    # Derive a filename from the URL
    raw_name = url.split("?")[0].rstrip("/").split("/")[-1] or "imported_data"
    if "." not in raw_name:
        raw_name = f"{raw_name}.{fmt}"

    column_metadata = {
        col: {"dtype": str(df[col].dtype), "null_count": int(df[col].isnull().sum())}
        for col in df.columns
    }
    dataset = Dataset(
        project_id=project_id,
        filename=raw_name,
        storage_path=str(parquet_path),
        format=fmt,
        row_count=len(df),
        col_count=len(df.columns),
        column_metadata=column_metadata,
    )
    db.add(dataset)
    await db.flush()
    return dataset


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
