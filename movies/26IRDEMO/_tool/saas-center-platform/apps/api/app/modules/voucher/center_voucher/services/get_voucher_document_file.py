# 센터 바우처 자료 권한 체인 검증 (스트리밍 전 단계)
#
# 권한 체인: center_voucher → catalog voucher → voucher_document.
# center_voucher 스코프는 facade가 VerifyCenterVoucherScopeService로 선행 검증하고,
# 이 서비스는 카탈로그-자료 연결만 본다. global_document 파일 메타 조회는
# 타 모듈(document) 책임이라 application handler 가 document 루트 facade 로
# 수행한다 (모듈 비노출).
from app.modules.voucher.voucher_document.repository import VoucherDocumentRepository


class GetVoucherDocumentFileService:
    def __init__(
        self,
        repo: VoucherDocumentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        catalog_id: str,
        global_document_id: str,
    ) -> None:
        # 카탈로그-자료 연결 확인 (다른 사업 자료에 우회 접근 차단)
        await self.repo.get_pair(
            voucher_id=catalog_id,
            global_document_id=global_document_id,
        )
