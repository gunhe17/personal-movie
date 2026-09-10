# 바로링크로 나가는 상담 기록 — **발행된 공유문만**.
#
# 앱(client_app)의 get_profile_progress와 같은 집합을 같은 순서로 모은다. 다른 것은 게이트뿐이다:
#   앱   — 가족↔센터 연결(center_link active)이 열쇠
#   링크 — 4자리 인증으로 발급된 링크 토큰이 열쇠
# 그래서 여기서는 링크가 이미 증명한 것(center_id · case_id)만 믿고, 그 케이스의 내담자에게
# 달린 상담 회기 중 **published 공유문이 있는 것**만 내보낸다.
#
# ⚠️ 임상 원문(counseling_notes)은 이 경로에 실리지 않는다 — 나가는 것은 share.content['text'] 하나다.
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentCaseFacade
from app.modules.assessment.send_link.models import AssessmentSendLink
from app.modules.assessment.send_link.schemas import LinkJournalItem
from app.modules.counseling.facade import (
    CounselingCaseFacade,
    CounselingNoteShareFacade,
    CounselingSessionFacade,
)


async def collect_link_journals(
    link: AssessmentSendLink, uow: UnitOfWork
) -> list[LinkJournalItem]:
    client_ids = (
        await AssessmentCaseFacade(uow).aggregate_client_ids_by_case_ids([link.case_id])
    ).get(link.case_id, [])
    if not client_ids:
        return []

    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    share_facade = CounselingNoteShareFacade(uow)

    items: list[LinkJournalItem] = []
    for client_id in client_ids:
        case_ids = await case_facade.list_case_ids_by_participant_ids(
            [client_id], link.center_id
        )
        if not case_ids:
            continue
        sessions = await session_facade.get_sessions_by_case_ids(case_ids)
        if not sessions:
            continue
        shares = await share_facade.list_published_shares(
            session_ids=[s.id for s in sessions],
            client_id=client_id,
            center_id=link.center_id,
        )
        # 회기 시각은 일정(schedules)에 있다 — 한 번 더 조회하는 대신 회기 번호와 발행 시각으로 세운다
        session_no = {s.id: s.session_number for s in sessions}
        for share in shares:
            content = share.content or {}
            items.append(
                LinkJournalItem(
                    session_id=share.counseling_session_id,
                    session_no=session_no.get(share.counseling_session_id),
                    text=content.get("text"),
                    published_at=share.published_at,
                )
            )

    # 최근 회기가 위로 — 보호자는 방금 끝난 회기를 먼저 찾는다
    items.sort(key=lambda i: (i.session_no is None, i.session_no or 0), reverse=True)
    return items
