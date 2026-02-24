from datetime import datetime
from pydantic import BaseModel, HttpUrl


class DatasetResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    format: str
    row_count: int
    col_count: int
    column_metadata: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class DatasetPreview(BaseModel):
    columns: list[str]
    dtypes: dict[str, str]
    rows: list[dict]
    total_rows: int


class UrlImportRequest(BaseModel):
    url: str


class SampleImportRequest(BaseModel):
    sample_id: str


class SampleDatasetInfo(BaseModel):
    id: str
    name: str
    description: str
    rows: int
    cols: int
    tags: list[str]
