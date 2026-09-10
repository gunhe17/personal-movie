from ..models import FormTemplateStatus
from app.core.exceptions import InvalidOperationException
from app.modules.form.template.events import FormTemplateAtomic
from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class PublishTemplateService:
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
            raise InvalidOperationException("Cannot publish system template")

        if template.status == FormTemplateStatus.PUBLISHED:
            raise InvalidOperationException("Template is already published")

        if template.status != FormTemplateStatus.DRAFT:
            raise InvalidOperationException(
                f"Cannot publish template in status '{template.status}'"
            )

        # return
        template = await self.repo.update_in_place(
            id=template_id, status=FormTemplateStatus.PUBLISHED
        )
        assert template is not None
        return FormTemplateAtomic.updated(template=template, changed={"status": "published"})
