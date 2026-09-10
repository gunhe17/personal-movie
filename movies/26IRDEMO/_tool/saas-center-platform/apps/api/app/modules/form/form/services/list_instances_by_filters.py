from datetime import datetime

from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository


class ListInstancesByFiltersService:
    def __init__(self, repo: FormRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        status: str | None = None,
        template_id: str | None = None,
        submitted_from: datetime | None = None,
        submitted_to: datetime | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        limit: int = 50,
    ) -> list[Form]:
        # return
        return await self.repo.list_by_filters(
            center_id=center_id,
            status=status,
            template_id=template_id,
            submitted_from=submitted_from,
            submitted_to=submitted_to,
            created_from=created_from,
            created_to=created_to,
            limit=limit,
        )
