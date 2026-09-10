from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from ..experiment_run.schemas import ExperimentRunResponse, ExperimentRunSummary
from ..sample_dataset.schemas import SampleDatasetSummary


class ExperimentVariant(BaseModel):
    model_name: str
    provider: str = "openai"
    prompt_version_id: str | None = None
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    model_params: dict[str, Any] | None = None



class ExperimentGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    experiment_type: str
    sample_id: str
    status: str
    total_runs: int
    completed_runs: int
    failed_runs: int
    started_at: datetime | None = None
    completed_at: datetime | None = None
    best_run_id: str | None = None
    cheapest_run_id: str | None = None
    fastest_run_id: str | None = None
    total_cost_usd: float | None = None
    avg_latency_ms: int | None = None
    author_id: str | None = None
    tags: str | None = None
    memo: str | None = None
    created_at: datetime
    updated_at: datetime


class ExperimentGroupSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    experiment_type: str
    status: str
    total_runs: int
    completed_runs: int
    total_cost_usd: float | None = None
    created_at: datetime


class ExperimentGroupListResponse(BaseModel):
    items: list[ExperimentGroupSummary]
    total: int
    page: int
    size: int
    pages: int


class BatchCompareRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    experiment_type: str = Field(min_length=1)
    sample_id: str
    variants: list[ExperimentVariant] = Field(min_length=2, max_length=10)
    tags: str | None = Field(None, max_length=500)
    memo: str | None = None


class ComparisonSummary(BaseModel):
    best_quality: ExperimentRunSummary | None = None
    lowest_cost: ExperimentRunSummary | None = None
    fastest: ExperimentRunSummary | None = None


class ComparisonResultResponse(BaseModel):
    group: ExperimentGroupResponse
    sample: SampleDatasetSummary
    runs: list[ExperimentRunResponse]
    comparison_summary: ComparisonSummary
