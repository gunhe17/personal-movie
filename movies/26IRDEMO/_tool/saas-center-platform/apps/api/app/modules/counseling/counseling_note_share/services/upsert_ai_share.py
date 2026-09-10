from app.core.type import unset
from ..events import CounselingNoteShareAtomic
from ..models import CounselingNoteShare, NoteShareStatus
from ..repository import CounselingNoteShareRepository


class UpsertAiShareService:
    """AI 초안을 회기×내담자 한 자리에 적재한다.

    같은 자리에 이미 공유문이 있으면 덮어쓴다 — 재생성은 새 이력이 아니라 초안 교체다.
    발행된 공유문을 다시 생성하면 draft 로 되돌아간다(다시 발행해야 앱에 나간다).
    """

    def __init__(self, repo: CounselingNoteShareRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        session_id: str,
        client_id: str,
        content: dict,
        audience: str,
        author_id: str,
        counseling_note_id: str | None,
        llm_call_id: str | None,
    ) -> tuple[CounselingNoteShareAtomic, CounselingNoteShare]:
        existing = await self.repo.find_by_session_and_client(
            session_id=session_id,
            client_id=client_id,
            center_id=center_id,
        )
        if existing is None:
            share = await self.repo.add(
                center_id=center_id,
                counseling_session_id=session_id,
                client_id=client_id,
                content=content,
                audience=audience,
                author_id=author_id,
                counseling_note_id=counseling_note_id,
                llm_call_id=llm_call_id,
            )
            return CounselingNoteShareAtomic.created(share=share)

        updated = await self.repo.update_in_center(
            existing.id,
            center_id,
            content=content,
            audience=audience,
            status=NoteShareStatus.DRAFT,
            is_edited=False,
            published_at=None,
            author_id=author_id,
            counseling_note_id=counseling_note_id if counseling_note_id is not None else unset,
            llm_call_id=llm_call_id if llm_call_id is not None else unset,
        )
        return CounselingNoteShareAtomic.updated(
            share=updated,
            changed={"content": content, "audience": audience, "status": NoteShareStatus.DRAFT.value},
        )
