from app.core.exceptions import InvalidOperationException, QuotaExceededException
from app.core.type import uuid_str

from ..models import LedgerMedia, LedgerMediaType
from ..repository import LedgerMediaRepository

MAX_VIDEO_DURATION_MS = 60_000
MONTHLY_VIDEO_QUOTA = 10


class ReserveMediaService:
    def __init__(
        self,
        repo: LedgerMediaRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        entry_id: uuid_str,
        *,
        media_type: LedgerMediaType,
        quota_month: str,
        storage_path: str,
        duration_ms: int | None = None,
        author_person_id: uuid_str,
    ) -> LedgerMedia:
        # verify
        if media_type is LedgerMediaType.VIDEO:
            if duration_ms is None:
                raise InvalidOperationException("영상 길이를 알 수 없어요")
            if duration_ms > MAX_VIDEO_DURATION_MS:
                raise InvalidOperationException("영상은 1분까지 담을 수 있어요")

            used = await self.repo.count_by_author_in_quota_month(
                author_person_id=author_person_id,
                quota_month=quota_month,
                media_type=LedgerMediaType.VIDEO,
            )
            # 쿼터는 발급 시 예약 + 완료 시 확정 — 예약분(pending)도 사용량에 든다
            if used >= MONTHLY_VIDEO_QUOTA:
                raise QuotaExceededException(
                    "이번 달 영상은 여기까지 담겨요 — 다음 달 1일에 새로 열려요"
                )

        # compute
        sort_order = await self.repo.next_sort_order(entry_id=entry_id)

        # return
        return await self.repo.add(
            entry_id=entry_id,
            storage_path=storage_path,
            quota_month=quota_month,
            media_type=media_type,
            duration_ms=duration_ms,
            sort_order=sort_order,
        )
