from app.core.datetime_utils import utc_now
from app.core.type import uuid_str

from ..models import VoucherExtraction, VoucherExtractionStatus
from ..repository import VoucherExtractionRepository


class ResetExtractionForRetryService:
    def __init__(
        self,
        repo: VoucherExtractionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        extraction_id: uuid_str,
    ) -> VoucherExtraction:
        # return (실패 흔적 초기화 + 처음부터 재시작). 산출물 목록도 비운다 — 안 비우면
        # 실행마다 가공 md·서식 png 가 append 돼 같은 문서가 계속 쌓인다(171건 실측).
        # 문서 파일 자체는 남긴다: 이미 확정된 바우처의 voucher_documents 가 링크 중일 수 있다.
        return await self.repo.update_in_place(
            id=extraction_id,
            status=VoucherExtractionStatus.PROCESSING,
            started_at=utc_now(),
            completed_at=None,
            failed=None,
            failed_at=None,
            artifact_document_ids=[],
            progress={"stage": "route"},
        )
