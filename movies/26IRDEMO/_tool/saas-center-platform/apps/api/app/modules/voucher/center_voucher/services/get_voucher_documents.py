# 센터 바우처 — 카탈로그 연결 자료 링크 조회 서비스
#
# voucher_documents(voucher ↔ global_document) 를 통해 voucher 에 연결된
# global_document id + page_range 를 반환한다. global_document 본문 조회는
# 타 모듈(document) 책임이라 application handler 가 document 루트 facade 로
# 수행한다 (모듈 비노출).
from app.infrastructure.persistence.range import to_tuple
from app.modules.voucher.center_voucher.schemas import CenterVoucherDocumentLink
from app.modules.voucher.voucher_document.repository import VoucherDocumentRepository


def _format_page_range(value) -> str | None:
    pair = to_tuple(value)
    if pair is None:
        return None
    low, high = pair
    if low == high:
        return str(low)
    return f"{low}-{high}"


class GetVoucherDocumentsService:
    def __init__(
        self,
        repo: VoucherDocumentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        catalog_id: str,
    ) -> list[CenterVoucherDocumentLink]:
        links = await self.repo.list_by_voucher(voucher_id=catalog_id)
        return [
            CenterVoucherDocumentLink(
                global_document_id=link.global_document_id,
                page_range=_format_page_range(link.page_range),
            )
            for link in links
        ]
