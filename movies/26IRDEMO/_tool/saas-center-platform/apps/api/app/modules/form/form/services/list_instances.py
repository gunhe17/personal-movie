from app.infrastructure.persistence.new_repository import Page
from app.modules.form.form.models import Form
from app.modules.form.form.repository import FormRepository


class ListInstancesService:
    def __init__(self, repo: FormRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        status: str | None = None,
        template_id: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Form], Page]:
        # return
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            status=status,
            template_id=template_id,
            page=page,
            size=size,
        )
