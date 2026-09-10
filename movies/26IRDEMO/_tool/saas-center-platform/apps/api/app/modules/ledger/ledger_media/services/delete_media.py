from app.core.type import uuid_str

from ..models import LedgerMedia
from ..repository import LedgerMediaRepository


class DeleteMediaService:
    def __init__(
        self,
        repo: LedgerMediaRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        media_id: uuid_str,
        entry_id: uuid_str,
    ) -> LedgerMedia:
        # return
        return await self.repo.remove_in_entry(id=media_id, entry_id=entry_id)
