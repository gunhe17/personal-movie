"""가공된 markdown 을 global_document(.md 멤버)로 저장.

신 모델: 원본(pdf/hwpx)과 가공 markdown 은 같은 논리 파일이지만, 변형을 묶는 책임은
사용처(voucher 는 voucher_extractions 의 source/artifact id 리스트)에 있다 —
global_document 에 group_code 는 없다. 이 서비스는 병합 markdown 을 file_type='md'
global_document 로 새로 만들고, 그 id 를 extraction.artifact_document_ids 에 덧붙인다.

(구버전은 voucher_file.content_file_path 단일 슬롯에 저장했다.)
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.exceptions import InvalidOperationException
from app.core.logger import get_logger
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.voucher.facade.voucher_facade import VoucherFacade

logger = get_logger(__name__)


@dataclass
class SaveMarkdownResult:
    global_document_id: str
    storage_path: str
    size_bytes: int


class SaveVoucherMarkdownService:
    """가공 markdown → global_document(.md) 추가 + extraction.artifact_document_ids 갱신."""

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
        merged_markdown: str,
        name: str,
    ) -> SaveMarkdownResult:
        if not (extraction.source_document_ids or []):
            raise InvalidOperationException(
                "가공 결과를 저장할 원본 문서가 extraction 에 없습니다."
            )

        data = merged_markdown.encode("utf-8")
        md_doc = await self._gdoc_facade.add_variant(
            name=name,
            data=data,
            file_type="md",
            content_type="text/markdown",
        )

        await self._voucher_facade.add_extraction_artifact(
            extraction_id=extraction.id,
            document_id=md_doc.id,
        )

        logger.info(
            "save_voucher_markdown: extraction=%s md_doc=%s size=%d",
            extraction.id,
            md_doc.id,
            len(data),
        )
        return SaveMarkdownResult(
            global_document_id=md_doc.id,
            storage_path=md_doc.storage_path,
            size_bytes=len(data),
        )
