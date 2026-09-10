# v3: case ↔ client_voucher 직접 연결 제거 → voucher 자동 prefill 없음 (운영자가 모달에서 직접 선택)
from typing import TYPE_CHECKING

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork

if TYPE_CHECKING:
    from app.modules.billing.billable.schemas import BillablePrefillItem


async def build_billable_prefill_for_case_handler(
    *,
    center_id: str,
    case_type: str,
    case_id: str,
    uow: UnitOfWork,
) -> list["BillablePrefillItem"]:
    if case_type not in ("counseling", "assessment"):
        raise EntityNotFoundException(f"Unsupported case_type: {case_type}")

    from app.modules.billing.billable_item.models import BillableItemType

    if case_type == "counseling":
        references = await _build_counseling_references(
            center_id=center_id,
            case_id=case_id,
            uow=uow,
            BillableItemType=BillableItemType,
        )
    else:
        references = await _build_assessment_references(
            center_id=center_id,
            case_id=case_id,
            uow=uow,
            BillableItemType=BillableItemType,
        )

    if not references:
        return []

    items = await _enrich_with_price_list(
        center_id=center_id,
        references=references,
        uow=uow,
    )

    return items


async def _build_counseling_references(
    *,
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
    BillableItemType,
) -> list[tuple[str, str, object]]:
    from app.modules.center.facade import ProgramFacade
    from app.modules.counseling.facade import CounselingCaseFacade

    case = await CounselingCaseFacade(uow).get_case_by_id(
        case_id=case_id, center_id=center_id
    )

    if not case.program_id:
        return []

    program_facade = ProgramFacade(uow)
    program_map = await program_facade.get_programs_by_ids([case.program_id])
    program = program_map.get(case.program_id)
    label = program.name if program else "상담"

    return [(case.program_id, label, BillableItemType.SERVICE)]


async def _build_assessment_references(
    *,
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
    BillableItemType,
) -> list[tuple[str, str, object]]:
    from app.modules.assessment.facade import (
        AssessmentCaseFacade,
        AssessmentSetFacade,
        AssessmentTaskFacade,
    )

    case = await AssessmentCaseFacade(uow).get_case_by_id(
        center_id=center_id, case_id=case_id
    )

    task_facade = AssessmentTaskFacade(uow)
    set_facade = AssessmentSetFacade(uow)

    refs: list[tuple[str, str, BillableItemType]] = []

    set_summary = getattr(case, "set_summary", None)
    set_id: str | None = None
    if set_summary:
        set_id = (
            set_summary.get("set_id")
            if isinstance(set_summary, dict)
            else getattr(set_summary, "set_id", None)
        )

    set_assessment_ids: set[str] = set()
    if set_id:
        assessment_set = None
        try:
            assessment_set = await set_facade.get_set_with_response(
                center_id=center_id,
                set_id=set_id,
            )
        except EntityNotFoundException:
            # 세트가 삭제됨 → 세트 ref 제외, 모든 task를 개별로 복원
            assessment_set = None

        if assessment_set is not None:
            set_name = assessment_set.name or "검사 세트"
            refs.append((set_id, set_name, BillableItemType.PACKAGE))
            set_assessment_ids = {a.id for a in assessment_set.assessment_summary}

    # 세트로 PACKAGE 청구된 검사는 개별 task로 다시 청구하지 않음 (이중 청구 방지)
    tasks = await task_facade.get_tasks_by_case_id(case.id)

    assessment_summary = getattr(case, "assessment_summary", None) or []
    name_by_id: dict[str, str] = {}
    for a in assessment_summary:
        if isinstance(a, dict):
            aid = a.get("id")
            kor = a.get("kor_name") or a.get("eng_name") or a.get("code")
        else:
            aid = getattr(a, "id", None)
            kor = (
                getattr(a, "kor_name", None)
                or getattr(a, "eng_name", None)
                or getattr(a, "code", None)
            )
        if aid:
            name_by_id[aid] = kor or "검사"

    seen_assessment_ids: set[str] = set()
    for task in tasks:
        if task.assessment_id in set_assessment_ids:
            continue  # 세트(PACKAGE)로 이미 청구됨 → 개별 청구 제외 (이중 청구 방지)
        if task.assessment_id in seen_assessment_ids:
            continue
        seen_assessment_ids.add(task.assessment_id)
        label = f"{name_by_id.get(task.assessment_id, '검사')} 검사"
        refs.append((task.assessment_id, label, BillableItemType.SERVICE))

    return refs


async def _enrich_with_price_list(
    *,
    center_id: str,
    references: list[tuple[str, str, object]],
    uow: UnitOfWork,
) -> list["BillablePrefillItem"]:
    from app.modules.billing.billable.schemas import BillablePrefillItem
    from app.modules.billing.facade.price_list_facade import PriceListFacade

    ref_ids = [r[0] for r in references]
    facade = PriceListFacade(uow)
    price_lists = await facade.list_by_reference_ids_with_response(
        center_id=center_id,
        reference_ids=ref_ids,
    )
    price_by_ref = {p.reference_id: p for p in price_lists if p.reference_id}

    items: list[BillablePrefillItem] = []
    for ref_id, label, item_type in references:
        match = price_by_ref.get(ref_id)
        items.append(
            BillablePrefillItem(
                reference_id=ref_id,
                description=label,
                item_type=item_type,
                unit_price=match.unit_price if match else 0,
                price_list_id=match.id if match else None,
            )
        )
    return items


TOOL = {
    "name": "build_billable_prefill_for_case_handler",
    "permission": "read:billing",
    "purpose": "특정 상담/검사 케이스의 제공 항목을 단가표와 매칭해, 청구서 작성에 미리 채워 넣을 후보 항목 목록을 조회한다.",
    "keywords": [
        "build billable prefill for case",
        "청구서 미리채움",
        "프리필",
        "자동 채움",
        "청구 항목 추천",
        "케이스 청구 준비",
        "단가표 매칭",
        "청구 초안",
        "회차 자동 입력",
    ],
    "boundaries": "케이스(상담/검사) 기준으로 '청구서에 채울 항목 후보'만 계산해 돌려주는 읽기 전용 도구다. 여기서 실제 청구서를 만들지 않는다 — 후보를 확정해 발행하려면 create_billable_handler를 쓴다. 내담자 단위로 아직 청구 안 된 대상 세션 목록을 보려면 list_billable_targets_by_client_handler를, 센터 전체의 오늘까지 누락 청구를 보려면 list_missing_billables_until_today_handler를 쓴다. 단가표에 없는 항목은 단가 0·단가표 참조 없음으로 채워진다.",
    "output": "청구서에 미리 채울 후보 항목 목록.",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_type": {
                "type": "string",
                "title": "케이스 종류",
                "enum": ["counseling", "assessment"],
                "description": "케이스 종류: counseling(상담) 또는 assessment(검사).",
            },
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "프리필 대상 케이스(상담/검사)의 UUID.",
            },
        },
        "required": ["case_type", "case_id"],
    },
}
