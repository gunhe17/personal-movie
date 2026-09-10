# 원천 변경 → 영향받은 내담자의 케어보드 재구축 (반응).
#
# 각 원천 이벤트는 서로 다른 앵커(케이스·회기·일정·내담자)를 payload에 담는다. 여기서
# 앵커를 내담자로 환원한 뒤 rebuild를 부른다 — 원천마다 recorder를 따로 두면 반응·백필·
# 정합 크론 세 경로가 조용히 갈라지므로, 조립은 rebuild 한 곳만 소유한다.

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .rebuild_care_board import rebuild_care_board_handler


async def sync_care_board_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: uuid_str,  # noqa: ARG001 — 재구축은 자체 이벤트를 내지 않는다
    client_id: str | None = None,
    counseling_case_id: str | None = None,
    assessment_case_id: str | None = None,
    schedule_id: str | None = None,
) -> None:
    if not center_id:
        return

    client_ids = await _resolve_client_ids(
        uow,
        center_id=center_id,
        client_id=client_id,
        counseling_case_id=counseling_case_id,
        assessment_case_id=assessment_case_id,
        schedule_id=schedule_id,
    )
    for target in client_ids:
        await rebuild_care_board_handler(
            center_id=center_id, client_id=target, uow=uow
        )


async def _resolve_client_ids(
    uow: UnitOfWork,
    *,
    center_id: str,
    client_id: str | None,
    counseling_case_id: str | None,
    assessment_case_id: str | None,
    schedule_id: str | None,
) -> list[str]:
    from app.modules.assessment.facade import AssessmentCaseFacade
    from app.modules.counseling.facade import (
        CounselingCaseFacade,
        CounselingSessionFacade,
    )

    resolved: set[str] = set()
    if client_id:
        resolved.add(client_id)

    if counseling_case_id:
        by_case = await CounselingCaseFacade(uow).aggregate_active_client_ids_by_case_ids(
            [counseling_case_id]
        )
        resolved.update(by_case.get(counseling_case_id, []))

    if assessment_case_id:
        by_case = await AssessmentCaseFacade(uow).aggregate_client_ids_by_case_ids(
            [assessment_case_id]
        )
        resolved.update(by_case.get(assessment_case_id, []))

    if schedule_id:
        case_ids = await CounselingSessionFacade(uow).list_case_ids_by_schedule_ids(
            [schedule_id]
        )
        if case_ids:
            by_case = await CounselingCaseFacade(
                uow
            ).aggregate_active_client_ids_by_case_ids(case_ids)
            for ids in by_case.values():
                resolved.update(ids)

    return sorted(resolved)
