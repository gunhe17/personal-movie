from ..repository import CounselingNoteRepository


class ListWrittenSessionIdsService:
    def __init__(self, repo: CounselingNoteRepository):
        self.repo = repo

    async def execute(self, session_ids: list[str]) -> set[str]:
        return await self.repo.list_written_session_id_set(session_ids=session_ids)
