from app.modules.platform_admin.center.repository import AdminCenterClientRepository
from app.modules.platform_admin.center.schemas import (
    AdminCenterClient,
    AdminCenterClientStats,
)


def mask_name(name: str) -> str:
    # 이름 마스킹: 첫 글자 + * + 마지막 글자 (예: 김*수, 이**)
    if not name:
        return ""
    if len(name) == 1:
        return "*"
    if len(name) == 2:
        return name[0] + "*"
    return name[0] + "*" * (len(name) - 2) + name[-1]


class ListCenterClientsService:
    def __init__(self, repo: AdminCenterClientRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        status: str | None = None,
        page: int = 1,
        size: int = 10,
    ) -> tuple[list[AdminCenterClient], AdminCenterClientStats, int]:
        # 1. 센터 존재 확인
        center = await self.repo.get_center(center_id)

        # 2. 내담자 목록 조회 (필터 + 페이지네이션)
        rows, page_meta = await self.repo.list_clients_with_page(
            center_id=center_id,
            status=status,
            page=page,
            size=size,
        )

        items = [
            AdminCenterClient(
                id=c.id,
                code=c.code,
                masked_name=mask_name(c.name),
                status=c.status,
                gender=c.gender,
                created_at=c.created_at,
            )
            for c in rows
        ]

        # 3. 통계 (전체 기준, 필터 무관)
        stats_total, stats_active, stats_inactive = await self.repo.get_client_stats(center_id)
        stats = AdminCenterClientStats(
            total=stats_total,
            active=stats_active,
            inactive=stats_inactive,
        )

        return items, stats, page_meta["total"]
