from app.core.type import uuid_str

from ..events import ShareTokenAtomic
from ..models import ShareToken
from ..repository import ShareTokenRepository


class RecordDownloadService:
    def __init__(
        self,
        repo: ShareTokenRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        share_token_id: uuid_str,
    ) -> tuple[ShareTokenAtomic, ShareToken]:
        # mutate
        updated = await self.repo.increment_download_count(id=share_token_id)
        assert updated is not None

        # return
        return ShareTokenAtomic.downloaded(share_token=updated)
