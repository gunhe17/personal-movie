from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from ..models import FormTemplateStatus
from app.core.exceptions import InvalidOperationException
from app.modules.form.template.events import FormTemplateAtomic
from app.modules.form.template.form_schema import validate_form_schema
from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository


@dataclass
class ConfirmFormExtractionResult:
    template: FormTemplate
    created: (
        bool  # True: 새 row(v1 또는 버전 증가) / False: 기존 draft in-place 덮어쓰기
    )


class ConfirmFormExtractionService:
    def __init__(
        self,
        template_repo: FormTemplateRepository,
    ):
        self.template_repo = template_repo

    async def execute(
        self,
        *,
        name: str,
        center_id: str | None,
        schema: dict[str, Any],
    ) -> tuple[list[FormTemplateAtomic], ConfirmFormExtractionResult]:
        # verify
        try:
            validate_form_schema(schema)
        except ValidationError as e:
            raise InvalidOperationException(
                f"유효하지 않은 FormSchema 입니다: {e}"
            ) from e

        # load — 같은 시리즈 (center_id, name) 의 활성 템플릿 (NULL-aware)
        existing = await self.template_repo.find_active_by_center_and_name(
            center_id, name
        )

        # 없음 → v1 draft 신규
        if existing is None:
            template = await self._create_draft(
                name=name, center_id=center_id, schema=schema, version=1
            )
            atomic, _ = FormTemplateAtomic.created(template=template)
            return [atomic], ConfirmFormExtractionResult(
                template=template, created=True
            )

        # 활성이 draft → in-place 덮어쓰기 (draft 는 가변)
        if existing.status == FormTemplateStatus.DRAFT:
            updated = await self.template_repo.update_in_place(
                id=existing.id, schema=schema
            )
            assert updated is not None
            atomic, _ = FormTemplateAtomic.updated(
                template=updated, changed={"schema": schema}
            )
            return [atomic], ConfirmFormExtractionResult(
                template=updated, created=False
            )

        # 활성이 published(동결) → 비활성화 + 다음 버전 draft 신규
        next_version = await self.template_repo.next_version(center_id, name)
        deactivated = await self.template_repo.update_in_place(
            id=existing.id, is_active=False
        )
        assert deactivated is not None
        deactivated_atomic, _ = FormTemplateAtomic.deactivated(template=deactivated)
        template = await self._create_draft(
            name=name, center_id=center_id, schema=schema, version=next_version
        )
        version_atomic, _ = FormTemplateAtomic.version_created(template=template)
        return [deactivated_atomic, version_atomic], ConfirmFormExtractionResult(
            template=template, created=True
        )

    async def _create_draft(
        self,
        *,
        name: str,
        center_id: str | None,
        schema: dict[str, Any],
        version: int,
    ) -> FormTemplate:
        template = await self.template_repo.add(
            center_id=center_id,
            name=name,
            version=version,
            schema=schema,
            is_active=True,
            status=FormTemplateStatus.DRAFT,
        )
        return template
