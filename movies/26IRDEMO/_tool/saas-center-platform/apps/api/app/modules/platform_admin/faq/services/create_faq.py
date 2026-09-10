from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.faq.models import FAQ
from app.modules.platform_admin.faq.repository import FAQRepository


class CreateFAQService:
    def __init__(self, repo: FAQRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        category: str,
        question: str,
        answer: str,
        is_published: bool,
        actor_id: str,
    ) -> tuple[AdminAuditAtomic, FAQ]:
        # load
        sort_order = await self.repo.next_sort_order(category)

        # return
        faq = await self.repo.add(
            category=category,
            question=question,
            answer=answer,
            is_published=is_published,
            sort_order=sort_order,
            created_by=actor_id,
        )
        atomic = AdminAuditAtomic(
            _act="created",
            _entity_name="faq",
            _entity_id=faq.id,
            _payload={"data": {"id": faq.id, "question": faq.question}},
        )
        return atomic, faq
