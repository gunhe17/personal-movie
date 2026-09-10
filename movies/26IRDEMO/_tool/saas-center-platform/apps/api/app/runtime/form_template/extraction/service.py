"""extraction 1건의 원본(global_document) → 쪽별 PNG 렌더 + FormSchema 추출.

흐름 (모두 같은 service.execute() 안에서 sequence):
  1. extraction.source_document_id → global_document 로드, storage 에서 다운로드
  2. page_range → 대상 쪽 목록 (미지정이면 문서 전체)
  3. 쪽마다: PNG 렌더 → global_document 저장 → LLM 추출 → carve 좌표 정밀화
  4. 쪽 결과를 pages/fields/elements 한 벌로 병합 → FormSchema 검증 후 반환

extraction.image_document_id 는 첫 쪽 PNG — 목록·썸네일용 대표 1장이고,
쪽별 배경은 schema.pages[].image 가 소유한다.

호출자(executor)가 반환된 schema 를 extraction.completed 에 저장하고 status 전환.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.modules.form.extraction.models import FormExtraction

from pydantic import ValidationError

from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
)
from app.core.logger import get_logger
from app.infrastructure.storage.common.base import StorageClient
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.form.facade.form_extraction_facade import FormExtractionFacade
from app.modules.form.template.form_schema import validate_form_schema

from .carve_fit import CARVE_DPI, carve_fit_elements
from .render import render_page_pngs
from .schema_extraction import FormSchemaExtractor

logger = get_logger(__name__)


class ExtractFormSchemaService:
    def __init__(
        self,
        *,
        gdoc_facade: GlobalDocumentFacade,
        extraction_facade: FormExtractionFacade,
        storage: StorageClient,
        extractor: FormSchemaExtractor,
    ):
        self._gdoc_facade = gdoc_facade
        self._extraction_facade = extraction_facade
        self._storage = storage
        self._extractor = extractor

    async def execute(self, *, extraction: FormExtraction) -> dict:
        # 1. source global_document 확보 + 다운로드
        docs = await self._gdoc_facade.get_many([extraction.source_document_id])
        source = docs[0] if docs else None
        if source is None:
            raise EntityNotFoundException(
                f"원본 문서를 찾을 수 없습니다: {extraction.source_document_id}"
            )
        data = await self._storage.download_file(source.storage_path)

        # 2. page_range → 대상 쪽 목록 (미지정이면 문서 전체)
        page_nos = _resolve_pages(extraction)

        # 3. 쪽별 PNG 렌더
        rendered = render_page_pngs(
            data=data, file_type=source.file_type, pages=page_nos
        )
        logger.info(
            "form_extract: extraction=%s 렌더 완료 %d쪽 (source=%s)",
            extraction.id, len(rendered), source.file_type,
        )

        # CV 정밀화용 고해상도 렌더 — 표시용(150dpi)에서는 얇은 괘선이 뭉개져
        # 셀 검출이 3개까지 떨어진다(300dpi 에서 32개, 실측).
        cv_by_page: dict[int, bytes] = {}
        try:
            for no, png, _, _ in render_page_pngs(
                data=data, file_type=source.file_type, pages=page_nos, dpi=CARVE_DPI
            ):
                cv_by_page[no] = png
        except Exception:  # noqa: BLE001
            logger.warning("form_extract: CV 렌더 실패 — 표시 해상도로 정밀화", exc_info=True)

        pages: list[dict] = []
        fields: dict = {}
        elements: list[dict] = []
        first_image_doc_id: str | None = None

        for idx, (src_no, png_bytes, w, h) in enumerate(rendered, start=1):
            # 쪽마다 PNG 을 독립 global_document 로 선언 — 스키마는 그 경로를 가리킨다
            image_doc = await self._gdoc_facade.add_variant(
                name=f"{extraction.name} p{src_no}" if len(rendered) > 1 else extraction.name,
                data=png_bytes,
                file_type="png",
                content_type="image/png",
            )
            if first_image_doc_id is None:
                first_image_doc_id = image_doc.id

            extracted = await self._extractor.extract(
                png_bytes=png_bytes,
                page_w=w,
                page_h=h,
                extraction_id=extraction.id,
            )
            page_fields = extracted.get("fields") or {}
            page_elements = extracted.get("elements") or []

            page_elements, fixed = carve_fit_elements(
                png_bytes=cv_by_page.get(src_no, png_bytes),
                fields=page_fields,
                elements=page_elements,
            )
            logger.info(
                "form_extract: extraction=%s p%d 필드 %d · 좌표 정밀화 %d/%d",
                extraction.id, src_no, len(page_fields), fixed, len(page_elements),
            )

            # 쪽 간 키 충돌 — 뒤 쪽 키에 접미를 붙여 살린다(버리지 않는다)
            renamed: dict[str, str] = {}
            for key, fdef in page_fields.items():
                new_key = key if key not in fields else f"{key}_p{idx}"
                renamed[key] = new_key
                fields[new_key] = fdef
            for el in page_elements:
                el["page"] = idx
                el["id"] = f"p{idx}_{el['id']}"
                el["field_refs"] = [renamed.get(r, r) for r in (el.get("field_refs") or [])]
                elements.append(el)

            pages.append({"no": idx, "image": image_doc.storage_path, "w": w, "h": h})

        if first_image_doc_id:
            await self._extraction_facade.set_image_document(
                extraction_id=extraction.id,
                image_document_id=first_image_doc_id,
            )

        schema = {"pages": pages, "fields": fields, "elements": elements}
        try:
            validate_form_schema(schema)
        except ValidationError as e:
            raise InvalidOperationException(
                f"추출된 FormSchema 가 계약을 위반했습니다: {e}"
            ) from e
        return schema


def _resolve_pages(extraction: FormExtraction) -> list[int] | None:
    """page_range → 대상 쪽 목록. 비어 있으면 None(문서 전체)."""
    pr = extraction.page_range
    if pr is None or pr.isempty:
        return None
    low, high = pr.lower, pr.upper
    if low is None or high is None:
        return None
    if pr.lower_inc is False:
        low += 1
    if pr.upper_inc is False:
        high -= 1
    return list(range(low, high + 1))
