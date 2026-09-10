from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class GetTemplateService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        template_id: str,
        center_id: str,
    ) -> FormTemplate:
        # return
        return await self.repo.get_by_id_with_center(
            template_id=template_id,
            center_id=center_id,
        )
