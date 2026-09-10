from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..repository import FormSendRepository
from ..services import ListFormSendsService
from ..schemas import FormSendSummary


async def list_form_sends_handler(
    center_id: str,
    form_template_id: str,
    uow: UnitOfWork,
) -> list[FormSendSummary]:
    repo = uow.repo(FormSendRepository)
    service = ListFormSendsService(repo)
    sends = await service.execute(center_id, form_template_id)

    return [FormSendSummary.model_validate(s) for s in sends]


TOOL = {
    "name": "list_form_sends_handler",
    "permission": None,
    "purpose": "폼 템플릿의 발송 내역을 조회한다.",
    "keywords": ["폼 발송 목록", "설문 발송 내역", "form send 목록"],
    "boundaries": "한 폼 템플릿의 발송 내역(읽기). 발송 생성은 application/handlers/form 쪽.",
    "output": "폼 템플릿 발송 내역 목록 (FormSendSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "form_template_id": {
                "type": "string",
                "format": "uuid",
                "title": "폼 템플릿",
                "description": "발송 내역을 조회할 폼 템플릿의 UUID.",
            },
        },
        "required": ["form_template_id"],
    },
}
