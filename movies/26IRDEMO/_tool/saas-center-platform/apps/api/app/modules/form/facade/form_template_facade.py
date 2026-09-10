from typing import Any

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.extraction.file_validation import resolve_ext, validate_file
from app.modules.form.extraction.models import FormExtraction
from app.modules.form.extraction.repository import FormExtractionRepository
from app.modules.form.extraction.services import (
    CreateFormExtractionService,
    DeleteFormExtractionService,
    GetFormExtractionService,
    MarkFailedService as MarkExtractionFailedService,
    RetryFormExtractionService,
)
from app.modules.form.template.events import FormTemplateAtomic
from app.modules.form.template.models import FormTemplate
from app.modules.form.template.repository import FormTemplateRepository
from app.modules.form.template.services.confirm_extraction import (
    ConfirmFormExtractionResult,
    ConfirmFormExtractionService,
)
from app.modules.form.template.schemas import (
    TemplateListResponse,
    TemplateResponse,
    TemplateSummary,
)
from app.modules.form.template.services.clone_template import CloneTemplateService
from app.modules.form.template.services.create_template import CreateTemplateService
from app.modules.form.template.services.create_template_version import (
    CreateTemplateVersionService,
)
from app.modules.form.template.services.deactivate_template import (
    DeactivateTemplateService,
)
from app.modules.form.template.services.reactivate_template import (
    ReactivateTemplateService,
)
from app.modules.form.template.services.import_center_template import (
    ImportCenterTemplateService,
)
from app.modules.form.template.services.get_template import GetTemplateService
from app.modules.form.template.services.list_templates import ListTemplatesService


class FormTemplateFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> FormTemplateRepository:
        return self._uow.repo(FormTemplateRepository)

    def validate_extraction_file(
        self, *, filename: str | None, content_type: str | None, data: bytes
    ) -> str:
        validate_file(filename, content_type, data)
        return resolve_ext(filename, content_type)

    async def add_extraction(
        self,
        *,
        name: str,
        center_id: str | None,
        source_document_id: str,
        page_range: tuple[int, int] | None = None,
    ) -> FormExtraction:
        return await CreateFormExtractionService(
            self._uow.repo(FormExtractionRepository)
        ).execute(
            name=name,
            center_id=center_id,
            source_document_id=source_document_id,
            page_range=page_range,
        )

    async def reset_extraction_for_retry(self, extraction_id: str) -> None:
        repo = self._uow.repo(FormExtractionRepository)
        await RetryFormExtractionService(repo).execute(extraction_id)

    async def delete_extraction(self, extraction_id: str) -> None:
        repo = self._uow.repo(FormExtractionRepository)
        await DeleteFormExtractionService(repo).execute(extraction_id)

    async def mark_extraction_failed(self, extraction_id: str, reason: str) -> bool:
        service = MarkExtractionFailedService(self._uow.repo(FormExtractionRepository))
        marked = await service.execute(extraction_id=extraction_id, reason=reason)
        return marked is not None

    async def confirm_extraction(
        self,
        extraction_id: str,
        name: str,
        schema: dict[str, Any],
    ) -> tuple[list[FormTemplateAtomic], ConfirmFormExtractionResult]:
        ext_repo = self._uow.repo(FormExtractionRepository)
        extraction = await GetFormExtractionService(ext_repo).execute(extraction_id)

        service = ConfirmFormExtractionService(self._repo())
        return await service.execute(
            name=name,
            center_id=extraction.center_id,
            schema=schema,
        )

    async def create_template(
        self,
        center_id: str,
        name: str,
        schema: dict[str, Any],
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        service = CreateTemplateService(self._repo())
        return await service.execute(center_id, name, schema)

    async def clone_template(
        self,
        source_template_id: str,
        center_id: str,
        name: str,
        schema: dict[str, Any] | None = None,
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        service = CloneTemplateService(self._repo())
        return await service.execute(source_template_id, center_id, name, schema)

    async def create_template_version(
        self,
        template_id: str,
        center_id: str,
        schema: dict[str, Any],
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        service = CreateTemplateVersionService(self._repo())
        return await service.execute(template_id, center_id, schema)

    async def get_template(
        self,
        template_id: str,
        center_id: str,
    ) -> FormTemplate:
        service = GetTemplateService(self._repo())
        return await service.execute(template_id, center_id)

    async def import_center_template(
        self,
        template_id: str,
        center_id: str,
    ) -> tuple[FormTemplateAtomic | None, FormTemplate]:
        service = ImportCenterTemplateService(self._repo())
        return await service.execute(template_id, center_id)

    async def list_templates(
        self,
        center_id: str,
        include_system: bool = True,
        include_inactive: bool = False,
    ) -> list[FormTemplate]:
        service = ListTemplatesService(self._repo())
        return await service.execute(center_id, include_system, include_inactive)

    async def deactivate_template(
        self,
        template_id: str,
        center_id: str,
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        service = DeactivateTemplateService(self._repo())
        return await service.execute(template_id, center_id)

    async def reactivate_template(
        self,
        template_id: str,
        center_id: str,
    ) -> tuple[FormTemplateAtomic, FormTemplate]:
        service = ReactivateTemplateService(self._repo())
        return await service.execute(template_id, center_id)

    async def get_template_with_response(
        self,
        template_id: str,
        center_id: str,
    ) -> TemplateResponse:
        template = await self.get_template(template_id, center_id)
        return TemplateResponse.model_validate(template)

    async def list_templates_with_response(
        self,
        center_id: str,
        include_system: bool = True,
        include_inactive: bool = False,
    ) -> TemplateListResponse:
        templates = await self.list_templates(center_id, include_system, include_inactive)
        from app.infrastructure.persistence.new_repository import single_page

        return TemplateListResponse(
            items=[TemplateSummary.model_validate(t) for t in templates],
            **single_page(templates),
        )

