# 센터 시점의 바우처 카탈로그 조회 서비스
#
# 어드민이 관리하는 카탈로그(`vouchers`)를 센터 화면에서 조회한다.
# 각 카탈로그 항목에 "현재 센터가 취급 중인지" 플래그를 함께 반환.
from datetime import date

from app.modules.voucher.voucher.repository import VoucherRepository


class ListVoucherCatalogService:
    def __init__(
        self,
        repo: VoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        active_catalog_ids: set[str],
        q: str | None = None,
        year: int | None = None,
        organization: str | None = None,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[dict], int]:
        # 카탈로그 목록
        catalogs, page_meta = await self.repo.list_with_filters_with_page(
            q=q,
            year=year,
            organization=organization,
            page=page,
            size=size,
        )
        total = page_meta["total"]
        today = date.today()

        # 카탈로그에 is_taken / is_expired 플래그 부여
        items = []
        for c in catalogs:
            is_expired = (
                c.usage_end_date is not None and c.usage_end_date < today
            )
            items.append({
                "id": c.id,
                "name": c.name,
                "program_name": c.program_name,
                "program_organization": c.program_organization,
                "program_year": c.program_year,
                "usage_start_date": c.usage_start_date,
                "usage_end_date": c.usage_end_date,
                "support_amount": c.support_amount,
                "is_taken": c.id in active_catalog_ids,
                "is_expired": is_expired,
            })

        return items, total
