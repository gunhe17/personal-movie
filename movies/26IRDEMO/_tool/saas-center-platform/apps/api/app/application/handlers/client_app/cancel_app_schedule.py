from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppScheduleCancelResponse
from app.modules.counseling.facade import (
    CounselingCaseFacade,
    CounselingSessionFacade,
)
from app.modules.event import emit
from app.modules.family.facade import FamilyFacade

_CANCEL_REASON = "내담자 앱에서 취소"


async def cancel_app_schedule_handler(
    *,
    person_id: uuid_str,
    schedule_id: uuid_str,
    reason: str | None,
    event_group_id: uuid_str,
    uow: UnitOfWork,
) -> AppScheduleCancelResponse:
    family_id = await FamilyFacade(uow).find_family_id(person_id=person_id)
    if family_id is None:
        raise InvalidOperationException("연결된 센터가 없습니다")

    links = await CenterLinkFacade(uow).list_links_by_family(
        family_id=family_id, alive_only=True
    )
    family_clients = {
        (link.center_id, link.client_id)
        for link in links
        if link.status == "active"
    }
    if not family_clients:
        raise InvalidOperationException("연결된 센터가 없습니다")

    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)

    # 취소된 회기는 case 매핑에서 빠진다 — 검사 일정도 여기서 None(앱 취소 미지원)
    case = (await case_facade.aggregate_cases_by_schedule_ids([schedule_id])).get(
        schedule_id
    )
    if case is None:
        raise InvalidOperationException("이 일정은 앱에서 취소할 수 없어요")

    center_id = case.center_id
    case_client_ids = (
        await case_facade.aggregate_active_client_ids_by_case_ids([case.id])
    ).get(case.id, [])
    if not any((center_id, cid) in family_clients for cid in case_client_ids):
        raise InvalidOperationException("이 일정을 취소할 권한이 없어요")

    sessions = await session_facade.get_sessions_by_case_ids([case.id])
    session = next(
        (s for s in sessions if s.schedule_id == schedule_id), None
    )
    if session is None:
        raise InvalidOperationException("이 일정은 앱에서 취소할 수 없어요")

    cancel_reason = (reason or "").strip() or _CANCEL_REASON
    atomic, _ = await session_facade.cancel_session_with_reason(
        session_id=session.id,
        center_id=center_id,
        counselor_id=None,
        cancel_reason=cancel_reason,
    )
    # 이벤트명을 staff 취소("counseling_session_cancelled")와 분리 — 그 이름의 기존
    # reaction(상담사 일반 문구)과 앱 전용 reaction의 이중 알림·staff 흐름 보호자 push 누출 방지
    await emit(
        uow,
        "app_schedule_cancelled",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
    )

    return AppScheduleCancelResponse(schedule_id=schedule_id)
