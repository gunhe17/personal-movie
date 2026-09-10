from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import CounselingCaseAnalysisRepository
from ..schemas import CaseAnalysisPreviewResponse
from ..services import (
    BuildCaseDataService,
    FindLatestAnalysisService,
    ListCompletedCaseSessionsService,
)
from app.modules.counseling.counseling_session.repository import (
    CounselingSessionRepository,
)
from app.modules.counseling.counseling_note.repository import CounselingNoteRepository


async def preview_case_analysis_handler(
    case_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> CaseAnalysisPreviewResponse:
    session_repo = uow.repo(CounselingSessionRepository)
    note_repo = uow.repo(CounselingNoteRepository)
    analysis_repo = uow.repo(CounselingCaseAnalysisRepository)

    completed_sessions = await ListCompletedCaseSessionsService(session_repo).execute(
        case_id
    )
    completed_ids = [s.id for s in completed_sessions]
    notes = []
    if completed_ids:
        notes = await note_repo.list_by_sessions(
            session_ids=completed_ids, center_id=center_id
        )
    data = BuildCaseDataService().execute(sessions=completed_sessions, notes=notes)

    latest = await FindLatestAnalysisService(analysis_repo).execute(case_id, center_id)

    if data["session_count"] == 0:
        msg = "완료된 세션이 없어 분석할 수 없어요."
    elif data["note_count"] == 0:
        msg = f"완료 세션 {data['session_count']}개가 있지만 상담일지가 없어요. 일지가 있으면 더 풍부한 분석이 가능해요."
    else:
        msg = f"완료 세션 {data['session_count']}개, 상담일지 {data['note_count']}개를 분석합니다."

    return CaseAnalysisPreviewResponse(
        session_count=data["session_count"],
        note_count=data["note_count"],
        has_previous_analysis=latest is not None,
        message=msg,
    )


TOOL = {
    "name": "preview_case_analysis_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스 분석의 미리보기를 조회한다.",
    "keywords": ["분석 미리보기", "케이스 분석 조회", "analysis preview"],
    "boundaries": "케이스 분석 결과/입력 미리보기(읽기). 분석 시작은 create_case_analysis_handler.",
    "output": "케이스 분석 미리보기 (CaseAnalysisPreviewResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "분석 미리보기를 볼 상담 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
