from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import BillableFacade
from app.modules.billing.billable.schemas import BillableSummary

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


async def _build_case_codes_by_billable(
    case_refs_by_billable: dict[str, list[tuple[str, str]]],
    uow: UnitOfWork,
) -> dict[str, list[str]]:
    all_refs: list[tuple[str, str]] = []
    for refs in case_refs_by_billable.values():
        all_refs.extend(refs)
    code_map = await _build_case_code_map(all_refs, uow)

    result: dict[str, list[str]] = {}
    for billable_id, refs in case_refs_by_billable.items():
        codes: list[str] = []
        seen: set[str] = set()
        for _, case_id in refs:
            code = code_map.get(case_id)
            if code and code not in seen:
                seen.add(code)
                codes.append(code)
        result[billable_id] = codes
    return result


async def _enrich_summaries(
    summaries: list[BillableSummary],
    uow: UnitOfWork,
    *,
    case_refs_by_billable: dict[str, list[tuple[str, str]]] | None = None,
    with_creator: bool = True,
) -> None:
    # case_refs_by_billable=None → case_codes 미채움, with_creator=False → 작성자명 미채움
    client_ids = list({s.client_id for s in summaries if s.client_id})
    client_map = await _fill_client_info(client_ids, uow)

    creator_map: dict[str, str] = {}
    if with_creator:
        account_ids = list({s.created_by for s in summaries if s.created_by})
        creator_map = await _fill_creator_names(account_ids, uow)

    case_codes_map: dict[str, list[str]] = {}
    if case_refs_by_billable:
        case_codes_map = await _build_case_codes_by_billable(case_refs_by_billable, uow)

    for summary in summaries:
        if summary.client_id in client_map:
            name, code, birth_date, gender, profile_image_url = client_map[
                summary.client_id
            ]
            summary.client_name = name
            summary.client_code = code
            summary.client_birth_date = birth_date
            summary.client_gender = gender
            summary.client_profile_image_url = profile_image_url
        if summary.created_by in creator_map:
            summary.created_by_name = creator_map[summary.created_by]
        if case_refs_by_billable is not None:
            summary.case_codes = case_codes_map.get(summary.id, [])


async def list_billables_by_related_handler(
    center_id: str,
    related_type: str | list[str],
    uow: UnitOfWork,
    related_case_id: str | None = None,
    related_session_id: str | None = None,
) -> list[BillableSummary]:
    facade = BillableFacade(uow)
    summaries = await facade.list_by_related_with_response(
        center_id=center_id,
        related_type=related_type,
        related_case_id=related_case_id,
        related_session_id=related_session_id,
    )
    await _enrich_summaries(summaries, uow, with_creator=False)
    return summaries


TOOL = {
    "name": "list_billables_by_related_handler",
    "permission": "read:billing",
    "purpose": "특정 케이스·세션 등에 연관된 청구 항목을 조회한다.",
    "keywords": [
        "list billables by related",
        "연관 청구",
        "케이스 청구 조회",
        "세션 청구",
        "관련 빌링",
        "연결된 청구",
    ],
    "boundaries": "주어진 연관 대상(케이스/세션)에 묶인 청구 항목만 조회(읽기 전용). 센터 전체 목록은 list_billables_handler.",
    "output": "연관 청구 항목 목록 (BillableSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "related_type": {
                "type": "string",
                "title": "연관 유형",
                "description": "연관 대상 유형(또는 유형 목록) — 예: case | session.",
            },
            "related_case_id": {
                "type": "string",
                "format": "uuid",
                "title": "연관 케이스",
                "description": "연관 케이스 UUID(선택).",
            },
            "related_session_id": {
                "type": "string",
                "format": "uuid",
                "title": "연관 세션",
                "description": "연관 세션 UUID(선택).",
            },
        },
        "required": [],
    },
}
