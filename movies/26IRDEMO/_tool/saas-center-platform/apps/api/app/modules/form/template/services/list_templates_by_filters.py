from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class ListTemplatesByFiltersService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        include_system: bool = True,
        name: str | None = None,
        is_active: bool | None = None,
        version: int | None = None,
    ) -> list[FormTemplate]:
        # return
        return await self.repo.list_by_filters(
            center_id=center_id,
            include_system=include_system,
            name=name,
            is_active=is_active,
            version=version,
        )
