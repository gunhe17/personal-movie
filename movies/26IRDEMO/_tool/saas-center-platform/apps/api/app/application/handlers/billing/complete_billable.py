from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.billing.facade import BillableFacade
from app.modules.billing.billable.schemas import (
    BillableItemResponse,
    BillableResponse,
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


async def complete_billable_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    billable_id: str,
    uow: UnitOfWork,
    actor_id: str | None,
) -> BillableResponse:
    facade = BillableFacade(uow)
    atomic, billable, items = await facade.complete_billable(
        center_id=center_id,
        billable_id=billable_id,
    )
    await emit(
        uow,
        "billable_completed",
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
    "name": "complete_billable_handler",
    "permission": "write:billing",
    "purpose": "청구서를 완납 처리한다(미수금 0·paid 전환).",
    "keywords": [
        "complete billable",
        "완납 처리",
        "청구 완료",
        "수납 마감",
        "청구 완납",
    ],
    "boundaries": "청구서를 '완납'으로 종결한다(머니 원장 자동 정합). 내용 수정은 update_billable_handler.",
    "output": "완납 처리된 청구서 (BillableResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "billable_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 청구서",
                "description": "완납 처리할 청구서의 UUID.",
            },
        },
        "required": ["billable_id"],
    },
}
