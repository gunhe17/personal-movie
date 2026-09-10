"""서식 페이지 PNG → global_document(.png 멤버) 저장.

S3 가 is_form=true 로 판정한 페이지(제출용 서식)만 PNG 로 영속화하고, 그 id 를
extraction.artifact_document_ids 에 덧붙인다 — 전 페이지 적재가 아니라
**서식으로 반환된 몇 장만** 적재한다.

가공 md(save_markdown)와 동일한 artifact 규약: 산출물은 source 와 분리된
artifact_document_ids 로만 참조된다.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.logger import get_logger
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.runtime.voucher_document.document_to_form.schemas import FormPage
from app.runtime.voucher_document.common.page_markdown import page_num
from app.runtime.voucher_document.common.pdf_processor import (
    PdfProcessor,
)

logger = get_logger(__name__)


@dataclass
class SavedFormPage:
    """서식 1장 적재 결과 — completed.forms 항목 재료."""

    page: str                        # "p-NNN"
    title: str
    kind: str
    global_document_id: str | None   # 적재 실패 시 None (판정 결과는 보존)


class SaveFormPagesService:
    """서식 페이지 PNG → global_document 추가 + artifact_document_ids 갱신."""

    def __init__(
        self,
        *,
        gdoc_facade: GlobalDocumentFacade,
        voucher_facade: VoucherFacade,
    ):
        self._gdoc_facade = gdoc_facade
        self._voucher_facade = voucher_facade

    async def execute(
        self,
        *,
        extraction,
        pdf_bytes: bytes,
        form_pages: list[FormPage],
        base_name: str,
    ) -> list[SavedFormPage]:
        """판정된 서식 페이지들을 PNG 로 렌더해 artifact 로 적재."""
        if not form_pages:
            return []

        processor = PdfProcessor(pdf_bytes)
        saved: list[SavedFormPage] = []

        for fp in form_pages:
            num = page_num(fp.page)
            if num is None or num > processor.page_count:
                saved.append(
                    SavedFormPage(
                        page=fp.page, title=fp.title, kind=fp.kind,
                        global_document_id=None,
                    )
                )
                continue

            png = processor.render_page_png(num)
            name = f"{base_name} 서식 {fp.page}" + (
                f" — {fp.title}" if fp.title else ""
            )
            doc = await self._gdoc_facade.add_variant(
                name=name[:255],
                data=png,
                file_type="png",
                content_type="image/png",
            )
            await self._voucher_facade.add_extraction_artifact(
                extraction_id=extraction.id,
                document_id=doc.id,
            )
            saved.append(
                SavedFormPage(
                    page=fp.page, title=fp.title, kind=fp.kind,
                    global_document_id=doc.id,
                )
            )

        logger.info(
            "save_form_pages: extraction=%s 서식 %d장 적재 (%s)",
            extraction.id, len(saved),
            ", ".join(s.page for s in saved),
        )
        return saved
