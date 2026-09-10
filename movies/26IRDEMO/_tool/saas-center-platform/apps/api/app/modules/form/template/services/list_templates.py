from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class ListTemplatesService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        include_system: bool = True,
        include_inactive: bool = False,
    ) -> list[FormTemplate]:
        return await self.repo.list_by_center(
            center_id=center_id,
            include_system=include_system,
            include_inactive=include_inactive,
        )
