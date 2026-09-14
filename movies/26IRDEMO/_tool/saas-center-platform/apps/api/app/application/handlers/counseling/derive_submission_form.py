"""확정 상담 일지 → 그 내담자의 바우처 양식 초안.

같은 일지를 제출처마다 다시 치지 않게 한다 — 일지 1장에서 양식 인스턴스 1장이
값까지 채워진 채 태어나고, '무엇을 무엇으로 옮겼나'는 counseling_note_derivations 에 남는다.
양식을 설계하는 AI 초안(form/template /draft)과 다른 물건이다: 저쪽은 빈 칸을 만들고
이쪽은 이미 있는 칸을 채운다.
"""

from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.counseling.counseling_note_derivation.schemas import (
    CounselingNoteDerivationResponse,
)
from app.modules.counseling.facade import (
    CounselingNoteDerivationFacade,
    CounselingNoteFacade,
    CounselingSessionFacade,
)
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.template.repository import FormTemplateRepository
from app.modules.form.template.services.get_template import GetTemplateService
from app.modules.llm.facade.ai_facade import create_ai_facade
from app.modules.schedule.facade.schedule_facade import ScheduleFacade
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade
from app.modules.voucher.facade.client_voucher_resource_facade import (
    ClientVoucherResourceFacade,
)
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.runtime.note_derivation.service import DeriveSubmissionFormService


async def derive_submission_form_handler(
    *,
    event_group_id: uuid_str,
    session_id: str,
    client_id: str,
    center_id: str,
    counselor_id: str | None,
    author_id: str,
    kind: str | None,
    uow: UnitOfWork,
    actor_id: str,
) -> CounselingNoteDerivationResponse:
    # 크레딧 게이트는 router 의 require_quota 가 이미 통과시켰다(ai-calling.md).
    session = await CounselingSessionFacade(uow).get_session(session_id, center_id)

    # 케이스 스코프 검증 + 원문 확보 — LLM 호출 전에 끝낸다
    notes = await CounselingNoteFacade(uow).list_notes_by_session_with_response(
        session_id=session_id,
        center_id=center_id,
        counselor_id=counselor_id,
        client_id=client_id,
        viewer_member_id=author_id,
    )
    note = notes[0] if notes else None
    if note is None:
        raise InvalidOperationException(
            "옮길 상담 일지가 없습니다. 일지를 먼저 작성해주세요."
        )
    content = note.content or {}
    if not any((content.get(k) or "").strip() for k in ("main_topic", "progress", "next_goal")):
        raise InvalidOperationException(
            "일지 내용이 비어 있어 제출 서류를 만들 수 없습니다."
        )

    client = await ClientFacade(uow).find_client_info(client_id)
    if client is None:
        raise InvalidOperationException("내담자를 찾을 수 없습니다.")

    # 바우처 → 양식 — 제출처가 정한 서식이라 상담사가 고르지 않는다
    client_voucher, template_id, resolved_kind = await _resolve_voucher_form(
        uow, center_id=center_id, client_id=client_id, kind=kind
    )

    template = await GetTemplateService(uow.repo(FormTemplateRepository)).execute(
        template_id, center_id
    )
    schema_fields = (template.schema or {}).get("fields") or {}
    if not schema_fields:
        raise InvalidOperationException(
            f"'{template.name}' 양식에 채울 칸이 없습니다."
        )

    schedule = await ScheduleFacade(uow).get_schedule(session.schedule_id, center_id)
    session_date = schedule.start.date().isoformat() if schedule else None

    values, llm_call_id = await DeriveSubmissionFormService(
        ai=create_ai_facade()
    ).execute(
        center_id=center_id,
        session_id=session_id,
        member_id=author_id,
        note_content=content,
        note_summary=note.summary,
        client_name=client.name,
        session_number=session.session_number,
        session_date=session_date,
        template_name=template.name,
        schema_fields=schema_fields,
    )

    # 양식 인스턴스를 만들고 그 자리에 값을 넣는다 — 상담사가 여는 것은 이 인스턴스다
    form_facade = FormFacade(uow)
    form_atomic, instance = await form_facade.create_instance(
        center_id=center_id,
        template_id=template_id,
        created_by=None,
    )
    await form_facade.upsert_answers_with_response(
        center_id=center_id,
        instance_id=instance.id,
        values=[
            {"field_key": key, "group_index": 0, "value": {"value": value}}
            for key, value in values.items()
        ],
    )
    # 제출 서류는 그 바우처에 달린다 — 정산 화면이 이 링크로 서류를 찾는다
    await ClientVoucherResourceFacade(uow).link_form_instance(
        center_id, client_voucher.id, instance.id
    )

    derivation = await CounselingNoteDerivationFacade(uow).create_derivation(
        center_id=center_id,
        counseling_note_id=note.id,
        counseling_session_id=session_id,
        client_id=client_id,
        author_id=author_id,
        kind=resolved_kind,
        generated_content={"values": values},
        content={
            "template_id": template_id,
            "template_name": template.name,
            "instance_id": instance.id,
            "client_voucher_id": client_voucher.id,
            "values": values,
        },
        llm_call_id=llm_call_id,
    )
    # ponytail: 파생 전용 이벤트를 새로 만들지 않는다 — 이 요청이 바깥에 남기는 것은
    # 결국 양식 인스턴스 1장이고, form_created 가 이미 그 자리다.
    await emit(
        uow,
        "form_created",
        event_group_id=event_group_id,
        atomics=[form_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return CounselingNoteDerivationResponse.model_validate(derivation)


async def _resolve_voucher_form(
    uow: UnitOfWork,
    *,
    center_id: str,
    client_id: str,
    kind: str | None,
):
    """(내담자 바우처, 양식 템플릿 id, 서류 종류). 바우처가 여럿이면 첫 것."""
    vouchers = await ClientVoucherFacade(uow).list_client_vouchers_with_response(
        center_id=center_id, client_id=client_id
    )
    voucher_facade = VoucherFacade(uow)
    for cv in vouchers.items:
        catalog_id = cv.catalog.id if cv.catalog else None
        if not catalog_id:
            continue
        links = await voucher_facade.list_form_templates_by_voucher(catalog_id)
        if not links:
            continue
        link = next((x for x in links if x.kind == kind), None) if kind else None
        link = link or links[0]
        return cv, link.form_template_id, link.kind
    raise InvalidOperationException(
        "이 내담자의 바우처에 연결된 제출 양식이 없습니다. 바우처 관리에서 양식을 먼저 연결해주세요."
    )


TOOL = {
    "name": "derive_submission_form_handler",
    "permission": "write:counseling_note",
    "purpose": "확정 상담 일지를 그 내담자의 바우처 제출 양식 초안으로 옮긴다.",
    "keywords": [
        "제출 서류",
        "바우처 양식 작성",
        "일지 파생",
        "서류 초안",
        "derive submission form",
    ],
    "boundaries": "확정 일지 → 바우처 양식 인스턴스(값 채움) 생성. 보호자 공유문은 generate_guardian_share_handler, 빈 양식 설계는 form 템플릿 AI 초안.",
    "output": "생성된 파생 기록 (CounselingNoteDerivationResponse, content.instance_id 가 작성 화면 주소).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "일지를 옮길 상담 회기의 UUID.",
            },
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "제출 서류를 만들 내담자의 UUID.",
            },
        },
        "required": ["session_id", "client_id"],
    },
}
