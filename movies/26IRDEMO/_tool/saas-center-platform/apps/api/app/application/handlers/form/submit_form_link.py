# 공개 표면(토큰 인증) — 보호자가 작성한 답변을 저장하고 제출한다.
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.send.schemas import FormLinkSubmitRequest


async def submit_form_link_handler(
    instance_id: str,
    center_id: str,
    data: FormLinkSubmitRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
) -> dict:
    facade = FormFacade(uow)
    await facade.upsert_answers_with_response(
        center_id=center_id,
        instance_id=instance_id,
        values=[v.model_dump() for v in data.values],
    )
    atomic, response = await facade.submit_instance(
        center_id=center_id,
        instance_id=instance_id,
        submitted_by=None,
    )
    await emit(
        uow,
        "form_submitted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=None,
    )
    return {"status": response.status.value if hasattr(response.status, "value") else response.status}
