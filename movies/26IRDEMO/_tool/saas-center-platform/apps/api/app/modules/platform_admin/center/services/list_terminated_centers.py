from datetime import timedelta
from app.core.datetime_utils import utc_now

from app.modules.platform_admin.center.repository import AdminCenterRepository
from app.modules.platform_admin.center.schemas import TerminatedCenterSummary


RETENTION_DAYS = 30


class ListTerminatedCentersService:
    def __init__(self, repo: AdminCenterRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        status: str | None = None,
        search: str | None = None,
        expiring_soon: bool = False,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[TerminatedCenterSummary], int]:
        centers, page_meta = await self.repo.list_terminated_centers_with_page(
            status=status,
            search=search,
            expiring_soon=expiring_soon,
            page=page,
            size=size,
        )

        now = utc_now()

        items = []
        for center in centers:
            expires_at = center.deleted_at + timedelta(days=RETENTION_DAYS)
            remaining = (expires_at - now).days
            items.append(
                TerminatedCenterSummary(
                    id=center.id,
                    name=center.name,
                    code=center.code,
                    representative_name=center.representative_name,
                    business_registration_number=center.business_registration_number,
                    deleted_at=center.deleted_at,
                    retention_expires_at=expires_at,
                    retention_remaining_days=max(0, remaining),
                    is_expired=remaining <= 0,
                    has_pending_export=False,
                    export_count=0,
                )
            )

        return items, page_meta["total"]
