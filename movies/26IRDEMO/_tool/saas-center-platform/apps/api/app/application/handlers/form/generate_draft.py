from app.modules.llm.facade.ai_facade import create_ai_facade
from app.runtime.form_generation.service import generate_form_draft

from app.modules.form.template.schemas import FormDraftResponse


async def generate_draft_handler(
    center_id: str,
    description: str,
) -> FormDraftResponse:
    # AIGateway 경유 단일 경로 — quota 체크·사용량 기록 통합(FORM_GENERATE_DRAFT 는 무료).
    # OPENROUTER_API_KEY 미설정이면 게이트웨이 호출 실패 → 서비스가 스켈레톤으로 폴백.
    ai_gateway = create_ai_facade()
    # 서비스가 내부에서 검증 + 실패 시 폴백 → 항상 유효 스키마 반환.
    schema = await generate_form_draft(
        description, ai_gateway=ai_gateway, center_id=center_id
    )
    return FormDraftResponse(schema_=schema)


TOOL = {
    "name": "generate_draft_handler",
    "permission": "write:form_template",
    "purpose": "설명을 바탕으로 AI가 폼 템플릿 초안(스키마)을 생성한다.",
    "keywords": ['generate draft', "AI 폼 생성", "양식 초안", "draft 생성", "폼 자동생성"],
    "boundaries": "자연어 설명으로 폼 스키마 'AI 초안' 생성. 정식 생성은 create_form_template_handler.",
    "output": "AI가 생성한 폼 초안 스키마 (FormDraftResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "description": {"type": "string", "title": "폼 설명", "description": "만들고 싶은 폼에 대한 자연어 설명."},
        },
        "required": ["description"],
    },
}
