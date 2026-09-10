from __future__ import annotations

from app.modules.form.extraction.models import FormExtraction

from ..schemas import FormExtractionSummary


def build_extraction_summary(
    extraction: FormExtraction,
) -> FormExtractionSummary:
    return FormExtractionSummary(
        id=extraction.id,
        status=extraction.status,
        name=extraction.name,
        center_id=extraction.center_id,
        source_document_id=extraction.source_document_id,
        page=extraction.page_range.lower if extraction.page_range else None,
        has_image=extraction.image_document_id is not None,
        started_at=extraction.started_at,
        completed_at=extraction.completed_at,
        failed_at=extraction.failed_at,
        created_at=extraction.created_at,
        updated_at=extraction.updated_at,
    )
