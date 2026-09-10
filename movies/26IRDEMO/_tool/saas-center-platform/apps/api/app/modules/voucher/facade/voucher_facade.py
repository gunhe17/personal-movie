from datetime import date

from app.core.type import unset, utc_dt
from app.infrastructure.persistence.range import to_range
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.client_voucher.events import ClientVoucherAtomic
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository
from app.modules.voucher.client_voucher.services.consume_sessions import (
    ConsumeSessionsService,
)
from app.modules.voucher.client_voucher.services.find_client_voucher import (
    FindClientVoucherService,
)
from app.modules.voucher.center_voucher.repository import CenterVoucherRepository
from app.modules.voucher.center_voucher.services.find_center_voucher import (
    FindCenterVoucherService,
)
from app.modules.voucher.voucher.repository import VoucherRepository
from app.modules.voucher.voucher.models import Voucher
from app.modules.voucher.voucher.services import (
    CreateVoucherService,
    FindVoucherService,
    GetVoucherService,
    ListVoucherCatalogService,
    UpdateVoucherService,
    DeleteVoucherService,
    ConfirmExtractionService,
    ConfirmExtractionResult,
)
from app.modules.voucher.voucher_document.models import VoucherDocument
from app.modules.voucher.voucher_document.repository import VoucherDocumentRepository
from app.modules.voucher.voucher_document.services.link_voucher_document import (
    LinkVoucherDocumentService,
)
from app.modules.voucher.voucher_document.services.list_voucher_documents import (
    ListVoucherDocumentsService,
)
from app.modules.voucher.voucher_form_template.models import VoucherFormTemplate
from app.modules.voucher.voucher_form_template.repository import (
    VoucherFormTemplateRepository,
)
from app.modules.voucher.voucher_form_template.services.link_voucher_form_template import (
    LinkVoucherFormTemplateService,
)
from app.modules.voucher.voucher_form_template.services.list_voucher_form_templates import (
    ListVoucherFormTemplatesService,
)
from app.modules.voucher.voucher_document.services.unlink_voucher_document import (
    UnlinkVoucherDocumentService,
)
from app.modules.voucher.voucher_extraction.file_validation import (
    resolve_ext,
    validate_file,
)
from app.modules.voucher.voucher_extraction.models import VoucherExtraction
from app.modules.voucher.voucher_extraction.repository import (
    VoucherExtractionRepository,
)
from app.modules.voucher.voucher_extraction.services import (
    AddArtifactDocumentService,
    ClaimExtractionStageService,
    ConfirmExtractionLayoutService,
    CreateExtractionService,
    DeleteExtractionService,
    FindExtractionService,
    GetExtractionService,
    ListExtractionsService,
    ListStuckProcessingService,
    ReleaseExtractionStageService,
    RequestStopExtractionService,
    MarkCompletedService,
    MarkFailedService,
    MarkReviewService,
    ResetExtractionForRetryService,
    ResumeExtractionService,
    UpdateExtractionProgressService,
)


class VoucherFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def create_voucher(
        self,
        *,
        name: str,
        program_name: str,
        program_organization: str,
        program_year: int,
        usage_start_date: date | None = None,
        usage_end_date: date | None = None,
        application_method: str | None = None,
        application_start_date: date | None = None,
        application_end_date: date | None = None,
        support_amount: dict | None = None,
        support_scope: str | None = None,
        support_target: str | None = None,
        contact: str | None = None,
        eligibility: dict | None = None,
    ) -> Voucher:
        return await CreateVoucherService(self._uow.repo(VoucherRepository)).execute(
            name=name,
            program_name=program_name,
            program_organization=program_organization,
            program_year=program_year,
            usage_start_date=usage_start_date,
            usage_end_date=usage_end_date,
            application_method=application_method,
            application_start_date=application_start_date,
            application_end_date=application_end_date,
            support_amount=support_amount,
            support_scope=support_scope,
            support_target=support_target,
            contact=contact,
            eligibility=eligibility,
        )

    async def list_catalog(self) -> list[Voucher]:
        return await ListVoucherCatalogService(
            self._uow.repo(VoucherRepository)
        ).execute()

    async def link_document(
        self,
        voucher_id: str,
        global_document_id: str,
        page_range: tuple[int, int] | None = None,
    ) -> tuple[VoucherDocument, bool]:
        repo = self._uow.repo(VoucherDocumentRepository)
        return await LinkVoucherDocumentService(repo).execute(
            voucher_id,
            global_document_id,
            page_range=to_range(page_range),
        )

    async def list_documents_by_voucher(
        self,
        voucher_id: str,
    ) -> list[VoucherDocument]:
        return await ListVoucherDocumentsService(
            self._uow.repo(VoucherDocumentRepository)
        ).execute(voucher_id)

    async def link_form_template(
        self,
        voucher_id: str,
        form_template_id: str,
        *,
        kind: str = "기타",
    ) -> tuple[VoucherFormTemplate, bool]:
        repo = self._uow.repo(VoucherFormTemplateRepository)
        return await LinkVoucherFormTemplateService(repo).execute(
            voucher_id,
            form_template_id,
            kind=kind,
        )

    async def list_form_templates_by_voucher(
        self,
        voucher_id: str,
    ) -> list[VoucherFormTemplate]:
        return await ListVoucherFormTemplatesService(
            self._uow.repo(VoucherFormTemplateRepository)
        ).execute(voucher_id)

    async def unlink_document(
        self,
        voucher_id: str,
        global_document_id: str,
    ) -> str:
        repo = self._uow.repo(VoucherDocumentRepository)
        return await UnlinkVoucherDocumentService(repo).execute(
            voucher_id,
            global_document_id,
        )

    async def verify_voucher_exists(self, voucher_id: str) -> Voucher:
        return await GetVoucherService(self._uow.repo(VoucherRepository)).execute(
            voucher_id
        )

    def validate_extraction_file(
        self, *, filename: str | None, content_type: str | None, data: bytes
    ) -> str:
        validate_file(filename, content_type, data)
        return resolve_ext(filename, content_type)

    async def add_extraction(
        self,
        *,
        source_document_ids: list[str],
        completed: dict,
    ) -> VoucherExtraction:
        return await CreateExtractionService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(
            source_document_ids=source_document_ids,
            completed=completed,
        )

    async def reset_extraction_for_retry(self, extraction_id: str) -> None:
        await ResetExtractionForRetryService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id)

    async def get_extraction(self, extraction_id: str) -> VoucherExtraction:
        return await GetExtractionService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id)

    async def list_stuck_processing_extractions(
        self, *, stale_before: utc_dt
    ) -> list[VoucherExtraction]:
        return await ListStuckProcessingService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(stale_before=stale_before)

    async def list_extractions(
        self,
        *,
        status: str | None = None,
        page: int = 1,
        size: int = 20,
    ):
        return await ListExtractionsService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(status=status, page=page, size=size)

    async def find_extraction_including_deleted(
        self, extraction_id: str
    ) -> VoucherExtraction | None:
        return await FindExtractionService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id)

    async def delete_extraction(self, extraction_id: str) -> None:
        await DeleteExtractionService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id)

    async def mark_extraction_failed(self, extraction_id: str, reason: str) -> bool:
        service = MarkFailedService(self._uow.repo(VoucherExtractionRepository))
        marked = await service.execute(extraction_id=extraction_id, reason=reason)
        return marked is not None

    async def claim_extraction_stage(
        self,
        extraction_id: str,
        *,
        stage: str,
    ) -> bool:
        return await ClaimExtractionStageService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id, stage=stage)

    async def release_extraction_stage(
        self,
        extraction_id: str,
        *,
        stage: str,
    ) -> None:
        await ReleaseExtractionStageService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id, stage=stage)

    async def mark_extraction_review(
        self,
        extraction_id: str,
    ) -> None:
        await MarkReviewService(self._uow.repo(VoucherExtractionRepository)).execute(
            extraction_id
        )

    async def confirm_extraction_layout(
        self,
        extraction_id: str,
        *,
        spans: list[dict],
        forms: list[dict],
    ) -> VoucherExtraction:
        return await ConfirmExtractionLayoutService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id, spans=spans, forms=forms)

    async def request_stop_extraction(
        self,
        extraction_id: str,
    ) -> bool:
        return await RequestStopExtractionService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id)

    async def resume_extraction(
        self,
        extraction_id: str,
    ) -> VoucherExtraction:
        return await ResumeExtractionService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id)

    async def update_extraction_progress(
        self,
        extraction_id: str,
        progress: dict,
    ) -> None:
        await UpdateExtractionProgressService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id, progress=progress)

    async def mark_extraction_completed(
        self,
        *,
        extraction_id: str,
        meta: dict,
        vouchers: list,
        forms: list,
    ) -> VoucherExtraction:
        service = MarkCompletedService(self._uow.repo(VoucherExtractionRepository))
        return await service.execute(
            extraction_id=extraction_id,
            meta=meta,
            vouchers=vouchers,
            forms=forms,
        )

    async def add_extraction_artifact(
        self,
        *,
        extraction_id: str,
        document_id: str,
    ) -> VoucherExtraction:
        service = AddArtifactDocumentService(
            self._uow.repo(VoucherExtractionRepository)
        )
        return await service.execute(
            extraction_id=extraction_id,
            document_id=document_id,
        )

    async def confirm_extraction(
        self,
        extraction_id: str,
        vouchers: list[dict],
    ) -> ConfirmExtractionResult:
        extraction = await GetExtractionService(
            self._uow.repo(VoucherExtractionRepository)
        ).execute(extraction_id)

        service = ConfirmExtractionService(
            self._uow.repo(VoucherRepository),
            self._uow.repo(VoucherDocumentRepository),
        )
        return await service.execute(
            vouchers=vouchers,
            document_ids=extraction.all_document_ids,
        )

    async def update_voucher(
        self,
        voucher_id: str,
        *,
        name: str = unset,
        program_name: str = unset,
        program_organization: str = unset,
        program_year: int = unset,
        usage_start_date: date | None = unset,
        usage_end_date: date | None = unset,
        application_method: str | None = unset,
        application_start_date: date | None = unset,
        application_end_date: date | None = unset,
        support_amount: dict | None = unset,
        support_scope: str | None = unset,
        support_target: str | None = unset,
        contact: str | None = unset,
        eligibility: dict | None = unset,
        record: dict | None = unset,
    ) -> Voucher:
        return await UpdateVoucherService(self._uow.repo(VoucherRepository)).execute(
            voucher_id,
            name=name,
            program_name=program_name,
            program_organization=program_organization,
            program_year=program_year,
            usage_start_date=usage_start_date,
            usage_end_date=usage_end_date,
            application_method=application_method,
            application_start_date=application_start_date,
            application_end_date=application_end_date,
            support_amount=support_amount,
            support_scope=support_scope,
            support_target=support_target,
            contact=contact,
            eligibility=eligibility,
            record=record,
        )

    async def delete_voucher(self, voucher_id: str) -> str:
        return await DeleteVoucherService(self._uow.repo(VoucherRepository)).execute(
            voucher_id
        )

    async def get_names_by_client_voucher_ids(
        self,
        client_voucher_ids: list[str],
    ) -> dict[str, str]:
        if not client_voucher_ids:
            return {}
        find_client_voucher = FindClientVoucherService(
            self._uow.repo(ClientVoucherRepository)
        )
        find_center_voucher = FindCenterVoucherService(
            self._uow.repo(CenterVoucherRepository)
        )
        find_catalog = FindVoucherService(self._uow.repo(VoucherRepository))

        result: dict[str, str] = {}
        for vid in set(client_voucher_ids):
            voucher = await find_client_voucher.execute(vid)
            if not voucher:
                continue
            center_voucher = await find_center_voucher.execute(
                voucher.center_voucher_id
            )
            if not center_voucher:
                continue
            catalog = await find_catalog.execute(center_voucher.catalog_id)
            if catalog:
                result[vid] = catalog.name
        return result

    async def consume_sessions(
        self,
        *,
        center_id: str,
        client_id: str,
        billable_date: date,
        consumption: dict[str, int],
        amount_consumption: dict[str, int] | None = None,
    ) -> tuple[list[ClientVoucherAtomic], list[str]]:
        return await ConsumeSessionsService(
            self._uow.repo(ClientVoucherRepository)
        ).execute(
            center_id,
            client_id,
            billable_date=billable_date,
            consumption=consumption,
            amount_consumption=amount_consumption,
        )
