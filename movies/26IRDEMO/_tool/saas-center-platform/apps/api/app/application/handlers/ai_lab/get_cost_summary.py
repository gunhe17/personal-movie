# 실험(ai_lab) lab 비용 + 프로덕션(llm) 비용 크로스 모듈 조합.
from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.ai_lab.experiment_run.schemas import CostSummaryResponse
from app.modules.ai_lab.facade import ExperimentFacade
from app.modules.llm.facade import LlmCallFacade


async def get_cost_summary_handler(
    uow: UnitOfWork,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    source_type: str | None = None,
) -> CostSummaryResponse:
    llm_facade = LlmCallFacade(uow)
    production = await llm_facade.get_production_cost_summary(
        source_type=source_type,
        date_from=date_from,
        date_to=date_to,
    )
    summary = await ExperimentFacade(uow).aggregate_costs(
        production_summary=production,
        date_from=date_from,
        date_to=date_to,
    )
    return CostSummaryResponse.model_validate(summary)


TOOL = {
    "name": "get_cost_summary_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "기간별 AI 비용을 프로덕션(실서비스 LLM 호출)과 실험실(ai_lab 실험 실행) 두 축으로 집계해 조회한다.",
    "keywords": [
        "get cost summary",
        "비용 요약",
        "AI 비용",
        "돈 얼마 들었어",
        "실험 비용",
        "프로덕션 비용",
        "토큰 비용",
        "비용 리포트",
        "비용 집계",
        "지출 통계",
    ],
    "boundaries": "운영자(어드민) 전용 읽기 도구로, '프로덕션 LLM 비용'과 'AI Lab 실험 비용'을 한 번에 묶어 기간/유형별로 보여준다. 센터별 크레딧 소비 통계는 get_credit_usage_handler를, AI Lab 메타데이터는 get_lab_metadata_handler를 쓴다. 이 도구는 비용 집계 전용이며 데이터를 변경하지 않는다.",
    "output": "프로덕션·실험실 두 축의 기간별 AI 비용 집계 (CostSummaryResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "date_from": {
                "type": "string",
                "format": "date-time",
                "title": "시작 일시",
                "description": "집계 시작 일시(이상). 비우면 처음부터.",
            },
            "date_to": {
                "type": "string",
                "format": "date-time",
                "title": "종료 일시",
                "description": "집계 종료 일시(미만). 비우면 현재까지.",
            },
            "source_type": {
                "type": "string",
                "title": "출처 필터",
                "description": "프로덕션 비용을 특정 출처로 한정하는 필터(예: field_note). 비우면 전체.",
            },
        },
        "required": [],
    },
}
