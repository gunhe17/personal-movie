from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.facade import CounselingSessionFacade
from app.modules.field_note.facade import FieldNoteFacade
from app.modules.field_note.pipeline.schemas import RecommendationResponse
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.llm.gateway.schemas import AICallContext
from app.modules.schedule.facade import ScheduleFacade
from app.runtime.field_note.prompts import RECOMMENDATION_SYSTEM_PROMPT


async def generate_recommendation_handler(
    field_note_id: str,
    center_id: str,
    uow: UnitOfWork,
    member_id: str | None = None,
) -> RecommendationResponse:
    fn_facade = FieldNoteFacade(uow)

    detail = await fn_facade.get_field_note_with_response(field_note_id, center_id)
    previous_summaries = await _collect_previous_summaries(
        detail.schedule_id,
        center_id,
        uow,
    )

    user_prompt = await fn_facade.generate_recommendation_context(
        field_note_id=field_note_id,
        center_id=center_id,
        previous_summaries=previous_summaries,
    )

    gateway = create_ai_facade()
    config = await gateway.resolve_config(
        "recommendation",
        default_prompt=RECOMMENDATION_SYSTEM_PROMPT,
    )
    system_prompt = config.get("system_prompt") or RECOMMENDATION_SYSTEM_PROMPT

    ctx = AICallContext(
        center_id=center_id,
        source_type="field_note",
        source_id=field_note_id,
        purpose=AIPurpose.FIELD_NOTE_RECOMMENDATION,
        pipeline_step="recommendation",
        member_id=member_id,
    )
    result = await gateway.generate_text(
        ctx,
        system_prompt,
        user_prompt,
        resolved_config=config,
    )

    return RecommendationResponse(recommendation=result.content)


async def _collect_previous_summaries(
    schedule_id: str | None,
    center_id: str,
    uow: UnitOfWork,
) -> list[str]:
    # counseling 일정에 한해 동일 케이스의 이전 회기 요약을 모은다 (그 외 빈 리스트).
    if not schedule_id:
        return []

    schedules = await ScheduleFacade(uow).list_schedules_by_ids([schedule_id])
    schedule = next((s for s in schedules if s.id == schedule_id), None)
    if not schedule or schedule.schedule_type != "counseling":
        return []

    counseling_facade = CounselingSessionFacade(uow)
    case_ids_dict = await counseling_facade.list_case_ids_by_schedule_ids([schedule_id])
    case_id = case_ids_dict.get(schedule_id)
    if not case_id:
        return []

    sessions = await counseling_facade.get_sessions_by_case_ids([case_id])
    previous_schedule_ids = [
        s.schedule_id
        for s in sessions
        if s.schedule_id and s.schedule_id != schedule_id
    ]
    if not previous_schedule_ids:
        return []

    previous_notes = await FieldNoteFacade(uow).get_summaries_by_schedule_ids(
        previous_schedule_ids,
        center_id,
    )
    return [n.summary for n in previous_notes if n.summary][:3]


TOOL = {
    "name": "generate_recommendation_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트로부터 AI 추천(권고) 문구를 생성한다.",
    "keywords": [
        "generate recommendation",
        "추천 생성",
        "AI 권고",
        "추천 문구",
        "recommendation 생성",
        "권고사항 작성",
    ],
    "boundaries": "필드노트 기반 AI '추천/권고' 생성. 상담 일지 생성은 generate_counseling_note_handler.",
    "output": "AI 추천/권고 문구 (RecommendationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "추천을 생성할 필드노트의 UUID.",
            },
        },
        "required": ["field_note_id"],
    },
}
