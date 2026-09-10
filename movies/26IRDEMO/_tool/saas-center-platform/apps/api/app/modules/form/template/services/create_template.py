from typing import Any

from pydantic import ValidationError

from ..models import FormTemplateStatus
from app.core.exceptions import ConflictException, InvalidOperationException
from app.modules.form.template.events import FormTemplateAtomic
from app.modules.form.template.form_schema import validate_form_schema
from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class CreateTemplateService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        name: str,
        schema: dict[str, Any],
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        # verify
        try:
            validate_form_schema(schema)
        except ValidationError as e:
            raise InvalidOperationException(f"Invalid form schema: {e}") from e

        existing = await self.repo.find_active_by_center_and_name(
            center_id=center_id,
            name=name,
        )
        if existing:
            raise ConflictException(
                f"Template with name '{name}' already exists in this center"
            )

        # return
        template = await self.repo.add(
            center_id=center_id,
            name=name,
            version=1,
            schema=schema,
            is_active=True,
            status=FormTemplateStatus.DRAFT,
        )
        return FormTemplateAtomic.created(template=template)
