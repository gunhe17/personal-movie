from app.core.exceptions import EntityNotFoundException
from app.modules.platform_admin.notice_read.repository import NoticeReadRepository


class GetCenterReadDetailService:
    def __init__(
        self,
        repo: NoticeReadRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        notice_id: str,
        center_id: str,
    ) -> tuple[str, list[dict]]:
        # 센터 이름 조회
        center_name = await self.repo.find_center_name(center_id=center_id)
        if not center_name:
            raise EntityNotFoundException(f"센터를 찾을 수 없습니다: {center_id}")

        # 멤버별 읽음 상세
        rows = await self.repo.aggregate_center_read_detail(
            notice_id=notice_id,
            center_id=center_id,
        )
        return center_name, rows
