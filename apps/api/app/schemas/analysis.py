from datetime import datetime
from pydantic import BaseModel
from typing import Literal


class AnalysisRequest(BaseModel):
    dataset_id: int
    project_id: int
    analysis_type: str
    parameters: dict = {}


class AnalysisResponse(BaseModel):
    id: int
    dataset_id: int
    project_id: int
    analysis_type: str
    parameters: dict
    results: dict | None
    status: str
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class VisualizationCreate(BaseModel):
    analysis_result_id: int
    chart_type: str
    config: dict = {}


class VisualizationResponse(BaseModel):
    id: int
    analysis_result_id: int
    chart_type: str
    plotly_json: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    project_id: int
    title: str
    sections: dict = {}
    export_format: Literal["pdf", "docx"] | None = None


class ReportResponse(BaseModel):
    id: int
    project_id: int
    title: str
    sections: dict
    export_format: str | None
    file_path: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
