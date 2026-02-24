import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.analysis import AnalysisResult
from app.models.dataset import Dataset
from app.models.user import User
from app.services.analysis.engine import run_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


# ── Schemas ────────────────────────────────────────────────────────────────

class AIAskRequest(BaseModel):
    question: str
    dataset_id: int
    project_id: int


class AIAskResponse(BaseModel):
    question: str
    reasoning: str
    analysis_type: str | None
    analysis_id: int | None
    interpretation: str
    status: str  # "answered" | "cannot_answer" | "failed"


# ── Analysis catalogue shown to Claude ────────────────────────────────────

_ANALYSIS_CATALOGUE = """
DESCRIPTIVE
- descriptive_statistics: Summary stats (mean, std, min/max, quartiles). params: {"columns": ["col1", "col2"]}
- frequency_table: Value counts for a categorical column. params: {"column": "col_name"}
- normality_test: Shapiro-Wilk normality test. params: {"columns": ["col1"]}
- pearson_correlation: Pearson r between two numeric columns. params: {"column1": "a", "column2": "b"}
- spearman_correlation: Spearman ρ between two numeric columns. params: {"column1": "a", "column2": "b"}

INFERENTIAL
- independent_t_test: Compare means of two groups. params: {"group_column": "cat_col", "value_column": "num_col"}
- paired_t_test: Compare paired measurements. params: {"column1": "before", "column2": "after"}
- one_sample_t_test: Test if mean equals a value. params: {"column": "col", "mu": 0}
- chi_square_test: Association between two categorical columns. params: {"column1": "cat1", "column2": "cat2"}
- one_way_anova: Compare means across 3+ groups. params: {"group_column": "cat_col", "value_column": "num_col"}

REGRESSION
- linear_regression: Predict numeric outcome from one predictor. params: {"dependent": "y", "independent": ["x"]}
- multiple_linear_regression: Predict from multiple predictors. params: {"dependent": "y", "independent": ["x1", "x2"]}
- logistic_regression: Predict binary outcome. params: {"dependent": "binary_col", "independent": ["x1", "x2"]}

NON-PARAMETRIC
- mann_whitney: Non-parametric two-group comparison. params: {"group_column": "cat_col", "value_column": "num_col"}
- kruskal_wallis: Non-parametric 3+ group comparison. params: {"group_column": "cat_col", "value_column": "num_col"}

MULTIVARIATE
- pca: Principal Component Analysis. params: {"columns": ["col1", "col2", "col3"], "n_components": 2}
- cluster_analysis: K-means clustering. params: {"columns": ["col1", "col2"], "n_clusters": 3}
"""


# ── Helpers ────────────────────────────────────────────────────────────────

def _column_info(dataset: Dataset) -> str:
    meta = dataset.column_metadata or {}
    rows = [
        f"  - {col} ({info.get('dtype', 'unknown')}, {info.get('null_count', 0)} nulls)"
        for col, info in meta.items()
    ]
    return "\n".join(rows) if rows else "  (no column metadata available)"


async def _claude(prompt: str) -> str:
    """Call Claude claude-haiku-4-5 and return the text response."""
    try:
        import anthropic  # lazy import so missing package only breaks /ai routes
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = await asyncio.to_thread(
            client.messages.create,
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    except Exception as exc:
        logger.error("Claude API error: %s", exc)
        raise


def _parse_json(raw: str) -> dict:
    """Extract JSON from Claude's response, stripping optional markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


# ── Endpoint ───────────────────────────────────────────────────────────────

@router.post("/ask", response_model=AIAskResponse)
async def ai_ask(
    data: AIAskRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI features not configured (ANTHROPIC_API_KEY missing)")

    # ── Load dataset ──────────────────────────────────────────────────────
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == data.dataset_id,
            Dataset.project_id == data.project_id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    col_info = _column_info(dataset)

    # ── Step 1: ask Claude to pick the right analysis ─────────────────────
    selection_prompt = f"""You are a statistical analysis assistant for a research data platform.

Dataset: {dataset.filename}
Columns:
{col_info}

Researcher's question: "{data.question}"

{_ANALYSIS_CATALOGUE}

Choose the most appropriate analysis for the question. Only use column names that exist above.

Respond with ONLY valid JSON — no markdown fences, no extra text:
{{
  "reasoning": "1-2 sentences explaining why this analysis fits the question",
  "analysis_type": "exact_type_string",
  "parameters": {{}},
  "cannot_answer": false,
  "message": ""
}}

If the question cannot be answered with the available data or analyses, set "cannot_answer": true, explain in "message", and leave "analysis_type" as "" and "parameters" as {{}}.
"""

    try:
        raw = await _claude(selection_prompt)
    except Exception:
        raise HTTPException(status_code=502, detail="AI service unavailable")

    try:
        selection = _parse_json(raw)
    except (json.JSONDecodeError, ValueError):
        logger.error("Non-JSON response from Claude: %s", raw)
        raise HTTPException(status_code=502, detail="AI returned an invalid response")

    if selection.get("cannot_answer"):
        return AIAskResponse(
            question=data.question,
            reasoning=selection.get("reasoning", ""),
            analysis_type=None,
            analysis_id=None,
            interpretation=selection.get("message", "I cannot answer this with the available data."),
            status="cannot_answer",
        )

    analysis_type: str = selection.get("analysis_type", "")
    parameters: dict = selection.get("parameters", {})
    reasoning: str = selection.get("reasoning", "")

    # ── Step 2: run the analysis ──────────────────────────────────────────
    analysis_record = AnalysisResult(
        dataset_id=data.dataset_id,
        project_id=data.project_id,
        analysis_type=analysis_type,
        parameters=parameters,
        status="running",
    )
    db.add(analysis_record)
    await db.flush()

    try:
        results = await asyncio.to_thread(
            run_analysis,
            analysis_type=analysis_type,
            parameters=parameters,
            data_path=dataset.storage_path,
        )
        analysis_record.results = results
        analysis_record.status = "completed"
        analysis_record.completed_at = datetime.now(timezone.utc)
    except Exception as exc:
        analysis_record.status = "failed"
        analysis_record.error_message = str(exc)
        await db.commit()
        await db.refresh(analysis_record)
        return AIAskResponse(
            question=data.question,
            reasoning=reasoning,
            analysis_type=analysis_type,
            analysis_id=analysis_record.id,
            interpretation=f"The analysis could not be completed: {exc}",
            status="failed",
        )

    await db.commit()
    await db.refresh(analysis_record)

    # ── Step 3: ask Claude to interpret the results ───────────────────────
    results_json = json.dumps(analysis_record.results, indent=2)[:3000]

    interpretation_prompt = f"""You are a statistical analyst explaining results to a researcher in plain language.

Analysis: {analysis_type.replace("_", " ").title()}
Researcher's question: "{data.question}"
Results:
{results_json}

Explain the key findings in 2-4 clear sentences. Be specific with important numbers. Avoid jargon where possible. Focus on what the results mean for the researcher's question."""

    try:
        interpretation = (await _claude(interpretation_prompt)).strip()
    except Exception:
        interpretation = "Analysis completed successfully. Please review the detailed results."

    return AIAskResponse(
        question=data.question,
        reasoning=reasoning,
        analysis_type=analysis_type,
        analysis_id=analysis_record.id,
        interpretation=interpretation,
        status="answered",
    )
