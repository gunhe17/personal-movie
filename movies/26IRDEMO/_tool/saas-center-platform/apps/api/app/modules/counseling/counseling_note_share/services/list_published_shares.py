from ..models import CounselingNoteShare
from ..repository import CounselingNoteShareRepository


class ListPublishedSharesService:
    """내담자 앱 읽기 경로 — 발행분만 나간다."""

    def __init__(self, repo: CounselingNoteShareRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        session_ids: list[str],
        client_id: str,
        center_id: str,
    ) -> list[CounselingNoteShare]:
        return await self.repo.list_published_by_sessions(
            session_ids=session_ids,
            client_id=client_id,
            center_id=center_id,
        )
