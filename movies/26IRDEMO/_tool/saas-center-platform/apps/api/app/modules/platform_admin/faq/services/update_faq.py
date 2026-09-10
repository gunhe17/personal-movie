from app.core.type import unset
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.faq.models import FAQ
from app.modules.platform_admin.faq.repository import FAQRepository


class UpdateFAQService:
    def __init__(self, repo: FAQRepository):
        self.repo = repo

    async def execute(
        self,
        faq_id: str,
        *,
        category: str = unset,
        question: str = unset,
        answer: str = unset,
        is_published: bool = unset,
        sort_order: int = unset,
    ) -> tuple[AdminAuditAtomic, FAQ]:
        # return
        faq = await self.repo.update_in_place(
            faq_id,
            category=category,
            question=question,
            answer=answer,
            is_published=is_published,
            sort_order=sort_order,
        )
        atomic = AdminAuditAtomic(
            _act="updated",
            _entity_name="faq",
            _entity_id=faq_id,
            _payload={"data": {"id": faq_id, "question": faq.question}},
        )
        return atomic, faq
