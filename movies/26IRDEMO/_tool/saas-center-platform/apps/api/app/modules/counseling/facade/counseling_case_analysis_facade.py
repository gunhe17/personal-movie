from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.counseling_case.repository import CounselingCaseRepository
from app.modules.counseling.counseling_case_analysis.events import CaseAnalysisAtomic
from app.modules.counseling.counseling_case_analysis.models import (
    CounselingCaseAnalysis,
)
from app.modules.counseling.counseling_case_analysis.repository import (
    CounselingCaseAnalysisRepository,
)
from app.modules.counseling.counseling_case.services import FindCounselingCaseService
from app.modules.counseling.counseling_case_analysis.services import (
    BuildCaseDataService,
    FindAnalysisService,
    ListCompletedCaseSessionsService,
    MarkAnalysisCompletedService,
    MarkAnalysisFailedService,
)
from app.modules.counseling.counseling_case_participant.repository import (
    CounselingCaseParticipantRepository,
)
from app.modules.counseling.counseling_case_participant.services import (
    ListAllClientIdsByCaseIdsService,
)
from app.modules.counseling.counseling_note.services import ListNotesBySessionsService
from app.modules.counseling.counseling_session_participant.services import (
    ListParticipantsBySessionIdsService,
)
from app.modules.counseling.counseling_note.repository import CounselingNoteRepository
from app.modules.counseling.counseling_session.repository import (
    CounselingSessionRepository,
)
from app.modules.counseling.counseling_session_participant.models import ParticipantType
from app.modules.counseling.counseling_session_participant.repository import (
    CounselingSessionParticipantRepository,
)


class CounselingCaseAnalysisFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def find_analysis(
        self,
        analysis_id: str,
    ) -> CounselingCaseAnalysis | None:
        repo = self._uow.repo(CounselingCaseAnalysisRepository)
        return await FindAnalysisService(repo).execute(analysis_id)

    async def load_analysis_source(
        self,
        case_id: str,
        center_id: str,
    ) -> dict:
        case = await FindCounselingCaseService(
            self._uow.repo(CounselingCaseRepository)
        ).execute(case_id, center_id)
        sessions = await ListCompletedCaseSessionsService(
            self._uow.repo(CounselingSessionRepository)
        ).execute(case_id)
        completed_ids = [s.id for s in sessions]
        notes = []
        if completed_ids:
            notes = await ListNotesBySessionsService(
                self._uow.repo(CounselingNoteRepository)
            ).execute(completed_ids, center_id)
        data = BuildCaseDataService().execute(sessions=sessions, notes=notes)
        return {"case": case, "data": data}

    async def list_case_client_ids(self, case_id: str) -> list[str]:
        """케이스 명단(내담자 id) — 그룹 판정과 일지 귀속 이름 해소의 앵커."""
        return await ListAllClientIdsByCaseIdsService(
            self._uow.repo(CounselingCaseParticipantRepository)
        ).execute([case_id])

    async def list_client_attendance_by_sessions(
        self,
        session_ids: list[str],
    ) -> dict[str, list[tuple[str, str]]]:
        """회기별 **(내담자 id, 출결)** 쌍.

        예전엔 상태 문자열만 돌려주고 id를 버렸다. 개인 케이스에서는 어차피 한 명이라
        문제가 없었지만, 그룹에서는 '누가' 왔는지가 곧 참석률의 분모다 — id를 버리면
        회기 단위로 접힌 값밖에 만들 수 없고, 한 명만 와도 그 회기는 참석이 된다.
        """
        if not session_ids:
            return {}
        participants = await ListParticipantsBySessionIdsService(
            self._uow.repo(CounselingSessionParticipantRepository)
        ).execute(session_ids)
        result: dict[str, list[tuple[str, str]]] = {}
        for p in participants:
            if p.participant_type == ParticipantType.CLIENT.value:
                result.setdefault(p.session_id, []).append(
                    (p.participant_id, p.attendance_status or "scheduled")
                )
        return result

    async def mark_analysis_completed(
        self,
        analysis_id: str,
        *,
        content: dict,
        session_count: int,
        model_used: str | None,
        input_tokens: int | None,
        output_tokens: int | None,
    ) -> tuple[CaseAnalysisAtomic, CounselingCaseAnalysis]:
        repo = self._uow.repo(CounselingCaseAnalysisRepository)
        return await MarkAnalysisCompletedService(repo).execute(
            analysis_id,
            content=content,
            session_count=session_count,
            model_used=model_used,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    async def mark_analysis_failed(
        self,
        analysis_id: str,
        *,
        error_message: str,
    ) -> tuple[CaseAnalysisAtomic, CounselingCaseAnalysis]:
        repo = self._uow.repo(CounselingCaseAnalysisRepository)
        return await MarkAnalysisFailedService(repo).execute(
            analysis_id, error_message=error_message
        )
