from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..counseling_case.repository import CounselingCaseRepository
from ..counseling_case.services import GetCounselingCaseService
from ..counseling_note_share.events import CounselingNoteShareAtomic
from ..counseling_note_share.models import CounselingNoteShare
from ..counseling_note_share.repository import CounselingNoteShareRepository
from ..counseling_note_share.schemas import CounselingNoteShareResponse
from ..counseling_note_share.services import (
    GetShareService,
    ListPublishedSharesService,
    ListSharesBySessionService,
    SetShareVisibilityService,
    UpdateShareService,
    UpsertAiShareService,
)
from ..counseling_session.repository import CounselingSessionRepository
from ..counseling_session.services import GetSessionService


class CounselingNoteShareFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def _assert_session_scope(
        self,
        *,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> None:
        # 노트와 같은 스코프 규칙 — 담당 상담사(own)면 자기 케이스만
        session = await GetSessionService(
            self._uow.repo(CounselingSessionRepository)
        ).execute(session_id, center_id)
        await GetCounselingCaseService(
            self._uow.repo(CounselingCaseRepository)
        ).execute(session.counseling_case_id, center_id, counselor_id)

    async def upsert_ai_share(
        self,
        *,
        center_id: str,
        session_id: str,
        client_id: str,
        content: dict,
        audience: str,
        author_id: str,
        counseling_note_id: str | None = None,
        llm_call_id: str | None = None,
    ) -> tuple[CounselingNoteShareAtomic, CounselingNoteShare]:
        repo = self._uow.repo(CounselingNoteShareRepository)
        return await UpsertAiShareService(repo).execute(
            center_id=center_id,
            session_id=session_id,
            client_id=client_id,
            content=content,
            audience=audience,
            author_id=author_id,
            counseling_note_id=counseling_note_id,
            llm_call_id=llm_call_id,
        )

    async def update_share(
        self,
        *,
        share_id: str,
        center_id: str,
        counselor_id: str | None,
        content: dict,
    ) -> tuple[CounselingNoteShareAtomic, CounselingNoteShare]:
        repo = self._uow.repo(CounselingNoteShareRepository)
        share = await GetShareService(repo).execute(share_id=share_id, center_id=center_id)
        await self._assert_session_scope(
            session_id=share.counseling_session_id,
            center_id=center_id,
            counselor_id=counselor_id,
        )
        return await UpdateShareService(repo).execute(
            share_id=share_id,
            center_id=center_id,
            content=content,
        )

    async def set_share_visibility(
        self,
        *,
        share_id: str,
        center_id: str,
        counselor_id: str | None,
        published: bool,
    ) -> tuple[CounselingNoteShareAtomic, CounselingNoteShare]:
        repo = self._uow.repo(CounselingNoteShareRepository)
        share = await GetShareService(repo).execute(share_id=share_id, center_id=center_id)
        await self._assert_session_scope(
            session_id=share.counseling_session_id,
            center_id=center_id,
            counselor_id=counselor_id,
        )
        return await SetShareVisibilityService(repo).execute(
            share_id=share_id,
            center_id=center_id,
            published=published,
        )

    async def get_share(
        self,
        *,
        share_id: str,
        center_id: str,
    ) -> CounselingNoteShare:
        repo = self._uow.repo(CounselingNoteShareRepository)
        return await GetShareService(repo).execute(share_id=share_id, center_id=center_id)

    async def list_shares_by_session(
        self,
        *,
        session_id: str,
        center_id: str,
        counselor_id: str | None = None,
    ) -> list[CounselingNoteShare]:
        if counselor_id is not None:
            await self._assert_session_scope(
                session_id=session_id,
                center_id=center_id,
                counselor_id=counselor_id,
            )
        repo = self._uow.repo(CounselingNoteShareRepository)
        return await ListSharesBySessionService(repo).execute(
            session_id=session_id,
            center_id=center_id,
        )

    async def list_shares_by_session_with_response(
        self,
        *,
        session_id: str,
        center_id: str,
        counselor_id: str | None = None,
    ) -> list[CounselingNoteShareResponse]:
        shares = await self.list_shares_by_session(
            session_id=session_id,
            center_id=center_id,
            counselor_id=counselor_id,
        )
        return [CounselingNoteShareResponse.model_validate(s) for s in shares]

    async def list_published_shares(
        self,
        *,
        session_ids: list[str],
        client_id: str,
        center_id: str,
    ) -> list[CounselingNoteShare]:
        repo = self._uow.repo(CounselingNoteShareRepository)
        return await ListPublishedSharesService(repo).execute(
            session_ids=session_ids,
            client_id=client_id,
            center_id=center_id,
        )
