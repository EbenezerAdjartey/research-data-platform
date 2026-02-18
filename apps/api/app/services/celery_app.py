from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "research_data_platform",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)


@celery_app.task(bind=True)
def run_analysis_task(self, analysis_id: int, analysis_type: str, parameters: dict, data_path: str):
    """Run an analysis asynchronously via Celery."""
    from app.services.analysis.engine import run_analysis

    self.update_state(state="RUNNING")
    try:
        results = run_analysis(analysis_type, parameters, data_path)
        return {"status": "completed", "results": results}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
