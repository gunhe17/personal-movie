from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.billing.facade import BillableFacade
from app.modules.billing.billable.schemas import (
    BillableItemResponse,
    BillableResponse,
    BillableUpdate,
)

from datetime import date


async def _fill_client_info(
    client_ids: list[str],
    uow: UnitOfWork,
) -> dict[str, tuple[str, str, date | None, str | None, str | None]]:
    # 표시용 내담자 정보는 client 모듈 소유 — handler 본문이 cross-module 조합
    if not client_ids:
        return {}
    from app.modules.client.facade import ClientFacade

    client_facade = ClientFacade(uow)
    client_map = await client_facade.get_clients_by_ids(client_ids)
    return {
        cid: (
            info.name,
            info.code or "",
            info.birth_date,
            info.gender,
            info.profile_image_url,
        )
        for cid, info in client_map.items()
    }


async def _fill_creator_names(
    account_ids: list[str],
    uow: UnitOfWork,
) -> dict[str, str]:
    if not account_ids:
        return {}
    from app.modules.person.facade import PersonFacade

    person_facade = PersonFacade(uow)
    result: dict[str, str] = {}
    for account_id in set(account_ids):
        person = await person_facade.find_person_by_account(account_id)
        if person:
            result[account_id] = person.name
    return result


async def _build_case_code_map(
    refs: list[tuple[str, str]],
    uow: UnitOfWork,
) -> dict[str, str]:
    counseling_ids: set[str] = set()
    assessment_ids: set[str] = set()
    for domain_type, case_id in refs:
        if domain_type == "counseling":
            counseling_ids.add(case_id)
        else:
            assessment_ids.add(case_id)

    result: dict[str, str] = {}
    if counseling_ids:
        from app.modules.counseling.facade import CounselingCaseFacade

        c_facade = CounselingCaseFacade(uow)
        result.update(await c_facade.get_case_codes_by_ids(list(counseling_ids)))
    if assessment_ids:
        from app.modules.assessment.facade import AssessmentCaseFacade

        a_facade = AssessmentCaseFacade(uow)
        result.update(await a_facade.get_case_codes_by_ids(list(assessment_ids)))
    return result


async def _build_voucher_name_map(
    voucher_ids: list[str],
    uow: UnitOfWork,
) -> dict[str, str]:
    from app.modules.voucher.facade.voucher_facade import VoucherFacade

    return await VoucherFacade(uow).get_names_by_client_voucher_ids(voucher_ids)


async def _enrich_detail(
    result: BillableResponse,
    uow: UnitOfWork,
) -> None:
    client_map = await _fill_client_info([result.client_id], uow)
    if result.client_id in client_map:
        name, code, birth_date, gender, profile_image_url = client_map[result.client_id]
        result.client_name = name
        result.client_code = code
        result.client_birth_date = birth_date
        result.client_gender = gender
        result.client_profile_image_url = profile_image_url

    creator_map = await _fill_creator_names([result.created_by], uow)
    if result.created_by in creator_map:
        result.created_by_name = creator_map[result.created_by]

    case_refs: list[tuple[str, str]] = []
    for item in result.items:
        if item.related_case_id and item.related_type:
            domain_type = (
                "counseling"
                if item.related_type.startswith("counseling")
                else "assessment"
            )
            case_refs.append((domain_type, item.related_case_id))
    code_by_case_id = await _build_case_code_map(case_refs, uow)
    for item in result.items:
        if item.related_case_id:
            item.related_case_code = code_by_case_id.get(item.related_case_id)

    voucher_ids = [
        item.client_voucher_id for item in result.items if item.client_voucher_id
    ]
    voucher_name_map = await _build_voucher_name_map(voucher_ids, uow)
    for item in result.items:
        if item.client_voucher_id:
            item.voucher_name = voucher_name_map.get(item.client_voucher_id)


async def update_billable_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    billable_id: str,
    data: BillableUpdate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> BillableResponse:
    facade = BillableFacade(uow)
    atomic, billable, items = await facade.update_billable(
        center_id=center_id,
        billable_id=billable_id,
        data=data,
    )
    await emit(
        uow,
        "billable_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    result = BillableResponse.model_validate(billable)
    result.items = [BillableItemResponse.model_validate(i) for i in items]
    await _enrich_detail(result, uow)
    return result


TOOL = {
    "name": "update_billable_handler",
    "permission": "write:billing",
    "purpose": "청구 항목의 내용을 수정한다.",
    "keywords": [
        "update billable",
        "청구 수정",
        "빌링 수정",
        "청구 항목 변경",
        "청구 편집",
        "billable 수정",
    ],
    "boundaries": "청구 항목 '내용' 수정. 완납 처리는 complete_billable_handler.",
    "output": "수정된 청구 항목 (BillableResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "billable_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 청구 항목",
                "description": "수정할 청구 항목의 UUID.",
            },
            "billable_date": {
                "anyOf": [{"format": "date", "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "청구 일자(미지정 시 유지).",
                "title": "청구 일자",
            },
            "due_date": {
                "anyOf": [{"format": "date", "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "납부 기한(미지정 시 유지).",
                "title": "납부 기한",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "메모(미지정 시 유지).",
                "title": "메모",
            },
            "discount_amount": {
                "anyOf": [{"minimum": 0, "type": "integer"}, {"type": "null"}],
                "default": None,
                "description": "청구서 전체 할인액(원, 미지정 시 유지).",
                "title": "할인액",
            },
        },
        "required": ["billable_id"],
    },
}
