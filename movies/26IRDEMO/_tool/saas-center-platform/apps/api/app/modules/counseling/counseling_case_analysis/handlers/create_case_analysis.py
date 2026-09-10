from app.core.schemas import StatusMessageResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.modules.event import emit
from ..services import ListCompletedCaseSessionsService, StartAnalysisService
from ..repository import CounselingCaseAnalysisRepository
from app.modules.counseling.counseling_session.repository import (
    CounselingSessionRepository,
)
from app.modules.counseling.counseling_case.repository import CounselingCaseRepository


async def create_case_analysis_handler(
    *,
    event_group_id: uuid_str,
    case_id: str,
    center_id: str,
    member_id: str,
    account_id: str,
    uow: UnitOfWork,
    actor_id: str,
    owner_scope: str | None = None,
    session_take: int | None = None,
) -> StatusMessageResponse:
    # verify — 케이스 실재 + 완료 회기 존재
    case_repo = uow.repo(CounselingCaseRepository)
    await case_repo.get_in_center(
        case_id=case_id, center_id=center_id, counselor_id=owner_scope
    )

    session_repo = uow.repo(CounselingSessionRepository)
    completed_sessions = await ListCompletedCaseSessionsService(session_repo).execute(
        case_id
    )
    if not completed_sessions:
        raise InvalidOperationException("완료된 세션이 없어 분석할 수 없습니다.")

    # start — processing 행 선생성, 실행은 반응(enqueue_case_analysis)→Track B 워커
    analysis_repo = uow.repo(CounselingCaseAnalysisRepository)
    atomic, _ = await StartAnalysisService(analysis_repo).execute(
        center_id=center_id,
        case_id=case_id,
        triggered_by=account_id,
        member_id=member_id,
        session_take=session_take,
    )
    await emit(
        uow,
        "counseling_case_analysis_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return StatusMessageResponse(status="started", message="종단 분석을 시작했습니다.")


TOOL = {
    "name": "create_case_analysis_handler",
    "permission": "write:counseling",
    "purpose": "상담 케이스의 종단(전체 회기) AI 분석을 시작한다.",
    "keywords": [
        "create case analysis",
        "케이스 분석",
        "종단 분석",
        "AI 사례 분석",
        "case analysis 생성",
    ],
    "boundaries": "케이스 전체 회기를 묶어 AI 종단 분석을 백그라운드로 '시작'한다. 미리보기는 preview_case_analysis_handler.",
    "output": "종단 분석 시작 결과 (StatusMessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "종단 분석을 시작할 상담 케이스의 UUID.",
            },
            "session_take": {
                "type": "integer",
                "minimum": 1,
                "title": "분석 범위",
                "description": "최근 N개 완료 회기만 분석. 미지정이면 전체 회기.",
            },
        },
        "required": ["case_id"],
    },
}
