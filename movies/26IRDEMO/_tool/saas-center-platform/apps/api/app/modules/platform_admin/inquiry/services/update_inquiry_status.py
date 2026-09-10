from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.inquiry.models import Inquiry
from app.modules.platform_admin.inquiry.repository import InquiryRepository


class UpdateInquiryStatusService:
    def __init__(
        self,
        repo: InquiryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        inquiry_id: str,
        *,
        status: str,
    ) -> tuple[AdminAuditAtomic, Inquiry]:
        # update
        inquiry = await self.repo.update_in_place(
            id=inquiry_id,
            status=status,
        )

        atomic = AdminAuditAtomic(
            _act="updated",
            _entity_name="inquiry",
            _entity_id=inquiry.id,
            _payload={"input": {"status": status}},
        )
        return atomic, inquiry
