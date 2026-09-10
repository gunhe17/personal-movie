from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.faq.repository import FAQRepository


class DeleteFAQService:
    def __init__(self, repo: FAQRepository):
        self.repo = repo

    async def execute(self, *, faq_id: str) -> tuple[AdminAuditAtomic, str]:
        # load
        faq = await self.repo.get_by_id(faq_id)

        # return
        await self.repo.remove_by_id(id=faq_id)
        atomic = AdminAuditAtomic(
            _act="deleted",
            _entity_name="faq",
            _entity_id=faq_id,
            _payload={"data": {"id": faq_id, "question": faq.question}},
        )
        return atomic, faq.question
