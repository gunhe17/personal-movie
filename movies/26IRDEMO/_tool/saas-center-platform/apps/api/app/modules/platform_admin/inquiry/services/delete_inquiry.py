from app.core.exceptions import EntityNotFoundException
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.inquiry.repository import InquiryRepository


class DeleteInquiryService:
    def __init__(self, repo: InquiryRepository):
        self.repo = repo

    async def execute(self, *, inquiry_id: str) -> tuple[AdminAuditAtomic, str]:
        # return
        inquiry = await self.repo.remove_by_id(inquiry_id)
        if not inquiry:
            raise EntityNotFoundException(f"문의를 찾을 수 없습니다: {inquiry_id}")

        atomic = AdminAuditAtomic(
            _act="deleted",
            _entity_name="inquiry",
            _entity_id=inquiry_id,
            _payload={"data": {"id": inquiry_id, "subject": inquiry.subject}},
        )
        return atomic, inquiry.subject
