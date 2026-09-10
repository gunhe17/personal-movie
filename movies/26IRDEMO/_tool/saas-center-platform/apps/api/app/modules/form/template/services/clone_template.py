from typing import Any

from pydantic import ValidationError

from ..models import FormTemplateStatus
from app.core.exceptions import (
    ConflictException,
    InvalidOperationException,
)
from app.modules.form.template.events import FormTemplateAtomic
from app.modules.form.template.form_schema import validate_form_schema
from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


class CloneTemplateService:
    def __init__(self, repo: FormTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        source_template_id: str,
        center_id: str,
        name: str,
        schema: dict[str, Any] | None = None,
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        # load
        source = await self.repo.get_by_id_with_center(
            template_id=source_template_id,
            center_id=center_id,
        )

        # verify
        existing = await self.repo.find_active_by_center_and_name(
            center_id=center_id,
            name=name,
        )
        if existing:
            raise ConflictException(
                f"Template with name '{name}' already exists in this center"
            )

        final_schema = schema if schema is not None else source.schema
        try:
            validate_form_schema(final_schema)
        except ValidationError as e:
            raise InvalidOperationException(f"Invalid form schema: {e}") from e

        # return
        cloned = await self.repo.add(
            center_id=center_id,
            name=name,
            version=1,
            schema=final_schema,
            is_active=True,
            status=FormTemplateStatus.DRAFT,
            # 사본의 사본도 뿌리(공용 서식)를 가리킨다 — 사슬을 만들지 않는다
            source_template_id=source.source_template_id or source.id,
        )
        return FormTemplateAtomic.cloned(template=cloned)
