from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..counseling_case.repository import CounselingCaseRepository
from ..counseling_case.services import GetCounselingCaseService

from ..counseling_session.repository import CounselingSessionRepository
from ..counseling_session.services import GetSessionService

from ..counseling_note.events import CounselingNoteAtomic
from ..counseling_note.models import CounselingNote
from ..counseling_note.schemas import (
    CounselingNoteCreate,
    CounselingNoteUpdate,
    CounselingNoteResponse,
)
from ..counseling_note.repository import CounselingNoteRepository
from ..counseling_note.services import (
    CreateNoteService,
    GetNoteService,
    GetNoteByIdService,
    UpdateNoteService,
    UpsertGeneratedNoteService,
    UpdateNoteByIdService,
    DeleteNoteByIdService,
    ListNotesBySessionService,
    ListNotesBySessionsService,
    ListNotesByAuthorIdsService,
)


class CounselingNoteFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    @staticmethod
    def _mask_private_notes(
        resp: CounselingNoteResponse,
        viewer_member_id: str | None,
    ) -> CounselingNoteResponse:
        if viewer_member_id and resp.author_id != viewer_member_id:
            content = dict(resp.content)
            content.pop("private_notes", None)
            resp.content = content
        return resp

    async def list_notes_by_sessions(
        self,
        session_ids: list[str],
        center_id: str,
    ) -> list:
        note_repo = self._uow.repo(CounselingNoteRepository)
        list_service = ListNotesBySessionsService(note_repo)
        return await list_service.execute(session_ids, center_id)

    async def list_my_notes(
        self,
        author_ids: list[str],
        center_id: str,
        keyword: str | None = None,
    ) -> list:
        note_repo = self._uow.repo(CounselingNoteRepository)
        service = ListNotesByAuthorIdsService(note_repo)
        return await service.execute(author_ids, center_id, keyword=keyword)

    async def list_notes_by_session_with_response(
        self,
        session_id: str,
        center_id: str,
        counselor_id: str | None,
        client_id: str | None = None,
        viewer_member_id: str | None = None,
    ) -> list[CounselingNoteResponse]:
        note_repo = self._uow.repo(CounselingNoteRepository)
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        list_service = ListNotesBySessionService(note_repo)
        notes = await list_service.execute(session_id, center_id, client_id)

        return [
            self._mask_private_notes(
                CounselingNoteResponse.model_validate(note), viewer_member_id
            )
            for note in notes
        ]

    async def create_note(
        self,
        session_id: str,
        client_id: str,
        center_id: str,
        author_id: str,
        counselor_id: str | None,
        mood: str | None = None,
        main_topic: str | None = None,
        intervention: list[str] | None = None,
        progress: str | None = None,
        homework: str | None = None,
        next_goal: str | None = None,
        raw_notes: str | None = None,
        private_notes: str | None = None,
        summary: str | None = None,
    ) -> tuple[CounselingNoteAtomic, CounselingNote]:
        from ..counseling_note.schemas import NoteContent

        note_repo = self._uow.repo(CounselingNoteRepository)
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(session_id, center_id)

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        content = NoteContent(
            mood=mood,
            main_topic=main_topic,
            intervention=intervention,
            progress=progress,
            homework=homework,
            next_goal=next_goal,
            raw_notes=raw_notes,
            private_notes=private_notes,
        )
        data = CounselingNoteCreate(
            client_id=client_id, content=content, summary=summary
        )

        create_service = CreateNoteService(note_repo)
        atomic, note = await create_service.execute(
            session_id=session_id,
            client_id=client_id,
            center_id=center_id,
            author_id=author_id,
            content=data.content.model_dump(),
            summary=data.summary,
        )

        return atomic, note

    async def get_note_by_id_with_response(
        self,
        note_id: str,
        center_id: str,
        counselor_id: str | None,
        viewer_member_id: str | None = None,
    ) -> CounselingNoteResponse:
        note_repo = self._uow.repo(CounselingNoteRepository)
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_note_service = GetNoteByIdService(note_repo)
        note = await get_note_service.execute(note_id, center_id)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(
            note.counseling_session_id, center_id
        )

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        resp = CounselingNoteResponse.model_validate(note)
        return self._mask_private_notes(resp, viewer_member_id)

    async def update_note_by_id(
        self,
        note_id: str,
        center_id: str,
        counselor_id: str | None,
        changed: dict | None = None,
        mood: str | None = None,
        main_topic: str | None = None,
        intervention: list[str] | None = None,
        progress: str | None = None,
        homework: str | None = None,
        next_goal: str | None = None,
        raw_notes: str | None = None,
        private_notes: str | None = None,
        summary: str | None = None,
    ) -> tuple[CounselingNoteAtomic, CounselingNote]:
        from ..counseling_note.schemas import NoteContent

        note_repo = self._uow.repo(CounselingNoteRepository)
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_note_service = GetNoteByIdService(note_repo)
        note = await get_note_service.execute(note_id, center_id)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(
            note.counseling_session_id, center_id
        )

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        content = NoteContent(
            mood=mood,
            main_topic=main_topic,
            intervention=intervention,
            progress=progress,
            homework=homework,
            next_goal=next_goal,
            raw_notes=raw_notes,
            private_notes=private_notes,
        )
        data = CounselingNoteUpdate(content=content, summary=summary)

        update_service = UpdateNoteByIdService(note_repo)
        atomic, updated_note = await update_service.execute(
            note_id=note_id,
            center_id=center_id,
            changed=changed,
            content=data.content.model_dump() if data.content is not None else None,
            summary=data.summary,
        )

        return atomic, updated_note

    async def delete_note_by_id(
        self,
        note_id: str,
        center_id: str,
        counselor_id: str | None,
    ) -> tuple[CounselingNoteAtomic, "CounselingNote"]:
        note_repo = self._uow.repo(CounselingNoteRepository)
        session_repo = self._uow.repo(CounselingSessionRepository)
        case_repo = self._uow.repo(CounselingCaseRepository)

        get_note_service = GetNoteByIdService(note_repo)
        note = await get_note_service.execute(note_id, center_id)

        get_session_service = GetSessionService(session_repo)
        session = await get_session_service.execute(
            note.counseling_session_id, center_id
        )

        get_case_service = GetCounselingCaseService(case_repo)
        await get_case_service.execute(
            session.counseling_case_id, center_id, counselor_id
        )

        delete_service = DeleteNoteByIdService(note_repo)
        return await delete_service.execute(note_id, center_id)

    async def upsert_generated_note(
        self,
        session_id: str,
        client_id: str,
        center_id: str,
        author_id: str,
        content: dict,
        summary: str | None,
    ) -> tuple[CounselingNoteAtomic, CounselingNote]:
        # 권한 검증 없이 시스템 내부 호출용 — field_note 파이프라인에서 사용
        note_repo = self._uow.repo(CounselingNoteRepository)
        service = UpsertGeneratedNoteService(note_repo)
        return await service.execute(
            session_id=session_id,
            client_id=client_id,
            center_id=center_id,
            author_id=author_id,
            content=content,
            summary=summary,
        )
