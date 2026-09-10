from app.core.type import uuid_str

from ..models import LedgerMedia, LedgerMediaUploadStatus
from ..repository import LedgerMediaRepository


class CompleteMediaService:
    def __init__(
        self,
        repo: LedgerMediaRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        media_id: uuid_str,
        entry_id: uuid_str,
        *,
        checksum: str | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> LedgerMedia:
        # 트랜스코딩(포스터·압축·서버측 길이 검증)은 워커 몫 — v1은 ready로 직행한다
        return await self.repo.update_in_entry(
            id=media_id,
            entry_id=entry_id,
            upload_status=LedgerMediaUploadStatus.READY,
            checksum=checksum,
            width=width,
            height=height,
        )
