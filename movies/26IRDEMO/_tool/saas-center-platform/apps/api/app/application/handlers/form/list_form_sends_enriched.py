from app.infrastructure.persistence.unit_of_work import UnitOfWork

from app.modules.form.facade import FormSendFacade
from app.modules.form.send.schemas import FormSendSummary
from app.modules.form.facade.form_facade import FormFacade


async def list_form_sends_enriched_handler(
    center_id: str,
    template_id: str,
    uow: UnitOfWork,
) -> list[FormSendSummary]:
    form_send_facade = FormSendFacade(uow)
    sends = await form_send_facade.list_form_sends(center_id, template_id)

    instance_ids: list[str] = []
    for s in sends:
        for r in s.recipients:
            iid = r.get("instance_id")
            if iid:
                instance_ids.append(iid)

    status_map: dict[str, str] = {}
    if instance_ids:
        form_facade = FormFacade(uow)
        instances = await form_facade.get_instances_by_ids(instance_ids, center_id)
        status_map = {i.id: i.status for i in instances}

    summaries: list[FormSendSummary] = []
    for s in sends:
        enriched = []
        for r in s.recipients:
            rr = dict(r)
            iid = rr.get("instance_id")
            rr["status"] = status_map.get(iid) if iid else None
            enriched.append(rr)
        summaries.append(
            FormSendSummary(
                id=s.id,
                recipients=enriched,
                channel=s.channel,
                created_at=s.created_at,
            )
        )

    return summaries


TOOL = {
    "name": "list_form_sends_enriched_handler",
    "permission": "read:form_instance",
    "purpose": "특정 폼 템플릿의 발송 내역을 조회한다.",
    "keywords": [
        "list form sends",
        "폼 발송 목록",
        "설문 발송 내역",
        "발송 기록",
        "form 발송 조회",
    ],
    "boundaries": "한 템플릿의 발송 내역(읽기 전용). 발송은 create_form_send_handler.",
    "output": "템플릿 발송 내역 목록 (FormSendSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {
                "type": "string",
                "format": "uuid",
                "title": "폼 템플릿",
                "description": "발송 내역을 조회할 폼 템플릿의 UUID.",
            },
        },
        "required": ["template_id"],
    },
}
