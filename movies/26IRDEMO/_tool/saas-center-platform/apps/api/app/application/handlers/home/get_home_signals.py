# 홈 횡단 신호(스펙 §4) — 상담사 단위 집계, count 0인 신호는 응답에 내리지 않는다
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .schemas import HomeSignalsResponse, PrepSignalItem, PrepSignalType

CASE_SCAN_LIMIT = 200  # 상담사 1인 담당 케이스 상한 가정 — 초과분은 신호 카운트에서 제외


async def get_home_signals_handler(
    center_id: str,
    counselor_id: str,
    uow: UnitOfWork,
) -> HomeSignalsResponse:
    from app.modules.assessment.facade import AssessmentCaseFacade, SendResultFacade
    from app.modules.billing.facade import BillableFacade
    from app.modules.counseling.facade import (
        CounselingSessionFacade,
        CounselingCaseFacade,
    )

    from ..counseling.list_my_counseling_cases import list_my_counseling_cases_handler

    # 연장 결정 — my_cases의 진행 회기 정의(참석+불참+노쇼)를 그대로 재사용. 진행중 status = "active"
    my_cases = await list_my_counseling_cases_handler(
        center_id, counselor_id, "active", 1, CASE_SCAN_LIMIT, uow
    )
    extension_count = sum(
        1
        for it in my_cases.items
        if it.total_sessions and it.completed_sessions >= it.total_sessions
    )

    async with uow:
        session_facade = CounselingSessionFacade(uow)
        unlogged = await session_facade.list_unlogged_completed_sessions_by_counselor(
            center_id, counselor_id
        )

        assessment_facade = AssessmentCaseFacade(uow)
        completed_cases, _ = await assessment_facade.list_cases(
            center_id,
            status="completed",
            counselor_id=counselor_id,
            size=CASE_SCAN_LIMIT,
        )
        send_facade = SendResultFacade(uow)
        unshared_case_ids = []
        for case in completed_cases:
            sends = await send_facade.list_send_results(center_id, case.id)
            if not sends:
                unshared_case_ids.append(case.id)

        # 미수 — 담당 상담(전 상태)+검사 케이스에 연결된 unpaid 청구
        case_facade = CounselingCaseFacade(uow)
        counseling_cases, _ = await case_facade.list_cases(
            center_id, counselor_id=counselor_id, limit=CASE_SCAN_LIMIT
        )
        all_assessment_cases, _ = await assessment_facade.list_cases(
            center_id, counselor_id=counselor_id, size=CASE_SCAN_LIMIT
        )
        my_case_ids = [c.id for c in counseling_cases] + [
            c.id for c in all_assessment_cases
        ]
        unpaid_count = await BillableFacade(uow).count_unpaid_by_case_ids(
            center_id=center_id,
            case_ids=my_case_ids,
        )

    signals: list[PrepSignalItem] = []
    if unlogged:
        signals.append(
            PrepSignalItem(
                signal_type=PrepSignalType.UNWRITTEN_JOURNALS,
                priority=1,
                label=f"상담일지 {len(unlogged)}건 미작성",
            )
        )
    if extension_count:
        signals.append(
            PrepSignalItem(
                signal_type=PrepSignalType.EXTENSION_NEEDED,
                priority=2,
                label=f"연장 확인 필요 {extension_count}건",
            )
        )
    if unshared_case_ids:
        signals.append(
            PrepSignalItem(
                signal_type=PrepSignalType.UNREVIEWED_ASSESSMENT,
                priority=3,
                label=f"검사 결과 미공유 {len(unshared_case_ids)}건",
                metadata={"case_ids": unshared_case_ids},
            )
        )
    if unpaid_count:
        signals.append(
            PrepSignalItem(
                signal_type=PrepSignalType.UNPAID_BILLING,
                priority=4,
                label=f"미수금 청구 {unpaid_count}건",
            )
        )

    return HomeSignalsResponse(signals=signals)



# #
# main

TOOL = {
    "permission": None,  # 멤버십만
    "name": "get_home_signals_handler",
    "purpose": "상담사 홈의 횡단 운영 신호(일지 미작성·연장 결정·결과 미공유·미수금)를 집계한다.",
    "keywords": ["홈 신호", "오늘 할 일", "일지 미작성 수", "미수금 신호", "연장 필요"],
    "boundaries": "상담사 단위 집계. 특정 일정의 준비 신호는 get_prep_signals_handler.",
    "output": "신호 목록 (HomeSignalsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {'type': 'string', 'format': 'uuid', 'title': '센터'},
            "counselor_id": {'type': 'string', 'format': 'uuid', 'title': '상담사 member'},
        },
        "required": ["center_id", "counselor_id"],
    },
}

def main() -> dict:
    return TOOL
