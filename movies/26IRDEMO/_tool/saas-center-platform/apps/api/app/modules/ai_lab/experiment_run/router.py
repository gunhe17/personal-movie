from datetime import datetime

from app.application.handlers.ai_lab.run_chain_experiment import run_chain_experiment_handler
from app.application.handlers.ai_lab.run_llm_experiment import run_llm_experiment_handler
from fastapi import APIRouter, Depends, Query

from app.behavior import behavior, AdminContext, UnscopedContext, authenticate_admin, require_role, start_event_group, dispatch_events
from app.core.schemas import OkResponse
from app.modules.platform_admin.admin_account.models import AdminRole
from app.application.handlers.ai_lab.get_cost_summary import get_cost_summary_handler
from .handlers import (
    run_stt_experiment_handler,
    run_text_diarize_eval_handler,
    evaluate_experiment_handler,
    calculate_diarization_accuracy_handler,
    generate_prompt_suggestion_handler,
    list_experiments_handler,
    get_experiment_handler,
    delete_experiment_handler,
)
from .schemas import (
    STTExperimentRequest,
    LLMExperimentRequest,
    ChainExperimentRequest,
    ExperimentRunResponse,
    ExperimentRunListResponse,
    ExperimentEvaluationUpdate,
    DiarizationAccuracyResponse,
    PromptSuggestionResponse,
    TextDiarizeEvalRequest,
    TextDiarizeEvalResponse,
    CostSummaryResponse,
)

router = APIRouter(prefix="/internal/ai-lab/experiments", tags=["AI Lab - Experiments"])


@router.post("/stt", response_model=ExperimentRunResponse)
async def run_stt_experiment(
    data: STTExperimentRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await run_stt_experiment_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.post(
    "/text-diarize-eval",
    response_model=TextDiarizeEvalResponse,
    description=(
        "정확한 외부 전사(화자+내용)를 정답으로 넣으면, LLM이 화자를 재배정한 결과와 "
        "비교해 세그먼트 정확도를 반환합니다."
    ),
)
async def run_text_diarize_eval(
    data: TextDiarizeEvalRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await run_text_diarize_eval_handler(data, ctx.uow)


@router.post("/llm", response_model=ExperimentRunResponse)
async def run_llm_experiment(
    data: LLMExperimentRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await run_llm_experiment_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.post(
    "/chain",
    response_model=ExperimentRunResponse,
)
async def run_chain_experiment(
    data: ChainExperimentRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await run_chain_experiment_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.patch("/{experiment_id}/evaluation", response_model=ExperimentRunResponse)
async def evaluate_experiment(
    experiment_id: str,
    data: ExperimentEvaluationUpdate,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await evaluate_experiment_handler(
        experiment_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.post(
    "/{experiment_id}/accuracy",
    response_model=DiarizationAccuracyResponse,
)
async def diarization_accuracy(
    experiment_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await calculate_diarization_accuracy_handler(experiment_id, ctx.uow)


@router.post(
    "/{experiment_id}/prompt-suggestion",
    response_model=PromptSuggestionResponse,
)
async def generate_prompt_suggestion(
    experiment_id: str,
    model: str = Query("gpt-4o", description="제안 생성에 쓸 LLM"),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await generate_prompt_suggestion_handler(experiment_id, model, ctx.uow)


@router.get("", response_model=ExperimentRunListResponse)
async def list_experiments(
    experiment_type: str | None = None,
    experiment_type_prefix: str | None = None,
    sample_id: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await list_experiments_handler(
        experiment_type, experiment_type_prefix, sample_id, status, page, size, ctx.uow
    )


@router.get("/{experiment_id}", response_model=ExperimentRunResponse)
async def get_experiment(
    experiment_id: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_experiment_handler(experiment_id, ctx.uow)


@router.delete("/{experiment_id}", response_model=OkResponse)
async def delete_experiment(
    experiment_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await delete_experiment_handler(
        experiment_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
    )


@router.get("/costs/summary", response_model=CostSummaryResponse)
async def get_cost_summary(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    source_type: str | None = None,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return await get_cost_summary_handler(
        ctx.uow,
        date_from=date_from,
        date_to=date_to,
        source_type=source_type,
    )
