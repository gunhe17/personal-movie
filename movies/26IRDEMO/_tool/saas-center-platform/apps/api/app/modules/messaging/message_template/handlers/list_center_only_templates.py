# NOTE: 현재 라우터에 연결되지 않은 미사용 핸들러 — 제거 후보(검토 필요). 라우트가 없어 도구화(TOOL) 대상 아님.
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import MessageTemplateListResponse
from ...facade import MessageTemplateFacade


async def list_center_only_templates_handler(
    center_id: str,
    uow: UnitOfWork,
    template_type: str | None = None,
) -> MessageTemplateListResponse:
    facade = MessageTemplateFacade(uow)
    result = await facade.list_center_only_templates_with_response(
        center_id, template_type
    )
    return result
