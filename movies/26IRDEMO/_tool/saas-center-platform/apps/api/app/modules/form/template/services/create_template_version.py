from typing import Any

from pydantic import ValidationError

from ..models import FormTemplateStatus
from app.core.exceptions import InvalidOperationException
from app.modules.form.template.events import FormTemplateAtomic
from app.modules.form.template.form_schema import validate_form_schema
from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class CreateTemplateVersionService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        template_id: str,
        center_id: str,
        schema: dict[str, Any],
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        # verify
        try:
            validate_form_schema(schema)
        except ValidationError as e:
            raise InvalidOperationException(f"Invalid form schema: {e}") from e

        current = await self.repo.get_by_id_with_center(
            template_id=template_id,
            center_id=center_id,
        )

        if current.center_id is None:
            raise InvalidOperationException(
                "Cannot modify system template. Clone it first."
            )

        if not current.is_active:
            raise InvalidOperationException(
                "Cannot create version from inactive template"
            )

        # deactivate
        await self.repo.update_in_place(id=template_id, is_active=False)

        version = await self.repo.next_version(
            center_id=center_id,
            name=current.name,
        )

        # return
        template = await self.repo.add(
            center_id=center_id,
            name=current.name,
            version=version,
            schema=schema,
            is_active=True,
            status=FormTemplateStatus.DRAFT,
        )
        return FormTemplateAtomic.version_created(template=template)
