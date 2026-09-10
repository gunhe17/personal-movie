from datetime import datetime, timedelta

from app.core.datetime_utils import utc_now
from app.core.exceptions import ConflictException, EntityNotFoundException
from app.modules.platform_admin.notice.repository import NoticeRepository

COOLDOWN_HOURS = 24
REMIND_ACTS = ["reminded", "notify_remind"]  # 구 act는 정명(2026-07-10) 전 행 조회용


class PrepareNoticeRemindService:
    def __init__(self, repo: NoticeRepository):
        self.repo = repo

    async def execute(
        self,
        notice_id: str,
        *,
        last_remind_at: datetime | None = None,
        center_id: str | None = None,
    ) -> tuple[str, int]:
        # verify
        notice = await self.repo.get_active(notice_id)
        if not notice.is_published:
            raise EntityNotFoundException("게시되지 않은 공지사항입니다.")

        # cooldown — 마지막 발송 시각(audit_logs 기반, 호출자 조회)이 24h 이내면 거부
        if last_remind_at is not None:
            elapsed = utc_now() - last_remind_at
            if elapsed < timedelta(hours=COOLDOWN_HOURS):
                remaining = timedelta(hours=COOLDOWN_HOURS) - elapsed
                remaining_hours = int(remaining.total_seconds() // 3600)
                remaining_minutes = int((remaining.total_seconds() % 3600) // 60)
                if remaining_hours > 0:
                    msg = f"마지막 발송 후 24시간이 지나지 않았습니다. {remaining_hours}시간 후 재발송 가능합니다."
                else:
                    msg = f"마지막 발송 후 24시간이 지나지 않았습니다. {remaining_minutes}분 후 재발송 가능합니다."
                raise ConflictException(msg)

        # count
        unread_count = await self.repo.count_unread_members(notice_id=notice_id, center_id=center_id)

        return notice.title, unread_count
