from app.modules.platform_admin.center.repository import AdminCenterRepository
from app.modules.platform_admin.center.schemas import AdminCenterSummary


class ListCentersService:
    def __init__(self, repo: AdminCenterRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        status: str | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AdminCenterSummary], int]:
        rows, total = await self.repo.list_centers_with_page(
            status=status,
            search=search,
            sort_by=sort_by,
            page=page,
            size=size,
        )

        items = [
            AdminCenterSummary(
                id=center.id,
                name=center.name,
                code=center.code,
                representative_name=center.representative_name,
                phone=center.phone,
                is_active=center.is_active,
                member_count=member_count,
                plan=plan,
                created_at=center.created_at,
            )
            for center, member_count, plan in rows
        ]

        return items, total
