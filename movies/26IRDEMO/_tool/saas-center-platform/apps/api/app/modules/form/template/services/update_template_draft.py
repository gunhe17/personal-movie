from typing import Any

from pydantic import ValidationError

from ..models import FormTemplateStatus
from app.core.exceptions import InvalidOperationException
from app.modules.form.template.events import FormTemplateAtomic
from app.modules.form.template.form_schema import validate_form_schema
from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class UpdateTemplateDraftService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        template_id: str,
        center_id: str,
        schema: dict[str, Any],
        changed: dict,
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        # verify
        try:
            validate_form_schema(schema)
        except ValidationError as e:
            raise InvalidOperationException(f"Invalid form schema: {e}") from e

        template = await self.repo.get_by_id_with_center(
            template_id=template_id,
            center_id=center_id,
        )

        if template.center_id is None:
            raise InvalidOperationException(
                "Cannot modify system template. Clone it first."
            )

        if template.status != FormTemplateStatus.DRAFT:
            raise InvalidOperationException(
                "Cannot edit a published template in place. "
                "Create a new version instead."
            )

        # return
        template = await self.repo.update_in_place(id=template_id, schema=schema)
        assert template is not None
        return FormTemplateAtomic.updated(template=template, changed=changed)
