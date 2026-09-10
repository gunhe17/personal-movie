from app.core.exceptions import InvalidOperationException
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.faq.repository import FAQRepository


class ReorderFAQsService:
    def __init__(
        self,
        repo: FAQRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        category: str,
        faq_ids: list[str],
    ) -> tuple[AdminAuditAtomic, int]:
        # verify — 요청된 ID가 모두 해당 카테고리에 속하는지
        existing_ids = set(await self.repo.list_ids_by_category(category=category))
        if not set(faq_ids).issubset(existing_ids):
            raise InvalidOperationException("요청에 포함된 FAQ ID 중 유효하지 않은 항목이 있습니다")

        # apply
        for order, faq_id in enumerate(faq_ids):
            await self.repo.update_in_place(faq_id, sort_order=order)

        atomic = AdminAuditAtomic(
            _act="updated",
            _entity_name="faq",
            _entity_id=category,
            _payload={"input": {"sort_order": faq_ids}},
        )
        return atomic, len(faq_ids)
