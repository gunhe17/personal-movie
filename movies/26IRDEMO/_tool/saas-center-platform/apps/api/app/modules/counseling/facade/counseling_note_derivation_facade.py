from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..counseling_case.repository import CounselingCaseRepository
from ..counseling_case.services import GetCounselingCaseService
from ..counseling_note_derivation.models import CounselingNoteDerivation
from ..counseling_note_derivation.repository import CounselingNoteDerivationRepository
from ..counseling_note_derivation.services import (
    CreateDerivationService,
    ListDerivationsService,
)
from ..counseling_session.repository import CounselingSessionRepository
from ..counseling_session.services import GetSessionService


class CounselingNoteDerivationFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> CounselingNoteDerivationRepository:
        return self._uow.repo(CounselingNoteDerivationRepository)

    async def assert_session_scope(
        self,
        *,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> None:
        # 공유문과 같은 스코프 규칙 — 담당 상담사(own)면 자기 케이스만
        session = await GetSessionService(
            self._uow.repo(CounselingSessionRepository)
        ).execute(session_id, center_id)
        await GetCounselingCaseService(
            self._uow.repo(CounselingCaseRepository)
        ).execute(session.counseling_case_id, center_id, counselor_id)

    async def create_derivation(
        self,
        *,
        center_id: str,
        counseling_note_id: str,
        counseling_session_id: str,
        client_id: str,
        author_id: str,
        kind: str,
        generated_content: dict,
        content: dict,
        llm_call_id: str | None = None,
    ) -> CounselingNoteDerivation:
        return await CreateDerivationService(self._repo()).execute(
            center_id=center_id,
            counseling_note_id=counseling_note_id,
            counseling_session_id=counseling_session_id,
            client_id=client_id,
            author_id=author_id,
            kind=kind,
            generated_content=generated_content,
            content=content,
            llm_call_id=llm_call_id,
        )

    async def list_derivations_by_session(
        self,
        *,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> list[CounselingNoteDerivation]:
        await self.assert_session_scope(
            session_id=session_id, center_id=center_id, counselor_id=counselor_id
        )
        return await ListDerivationsService(self._repo()).execute(
            session_id=session_id, center_id=center_id
        )
