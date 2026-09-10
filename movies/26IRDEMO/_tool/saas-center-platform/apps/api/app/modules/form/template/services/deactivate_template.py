from app.core.exceptions import InvalidOperationException
from app.modules.form.template.events import FormTemplateAtomic
from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class DeactivateTemplateService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        template_id: str,
        center_id: str,
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        # verify
        template = await self.repo.get_by_id_with_center(
            template_id=template_id,
            center_id=center_id,
        )

        if template.center_id is None:
            raise InvalidOperationException("Cannot deactivate system template")

        if not template.is_active:
            raise InvalidOperationException("Template is already inactive")

        # return
        updated = await self.repo.update_in_place(id=template_id, is_active=False)
        assert updated is not None
        return FormTemplateAtomic.deactivated(template=updated)
