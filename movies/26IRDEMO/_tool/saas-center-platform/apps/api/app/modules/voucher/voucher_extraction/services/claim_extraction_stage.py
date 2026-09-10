from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.core.type import uuid_str

from ..repository import VoucherExtractionRepository

# 이보다 오래 잡고 있으면 죽은 클레임으로 보고 회수 — 가장 긴 스테이지(field)가 여유 있게 끝나는 시간
STALE_AFTER = timedelta(minutes=15)


class ClaimExtractionStageService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
        *,
        stage: str,
    ) -> bool:
        now = utc_now()
        return await self.repo.claim_stage(
            id=extraction_id,
            stage=stage,
            now_iso=now.isoformat(),
            stale_iso=(now - STALE_AFTER).isoformat(),
        )
