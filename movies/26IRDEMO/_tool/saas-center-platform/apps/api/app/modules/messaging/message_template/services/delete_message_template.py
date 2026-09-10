from app.core.exceptions import EntityNotFoundException

from ..repository import MessageTemplateRepository
from ..events import MessageTemplateAtomic
from ..models import MessageTemplate


class DeleteMessageTemplateService:
    def __init__(self, repo: MessageTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str | None,
        template_id: str,
    ) -> tuple[MessageTemplateAtomic, MessageTemplate]:
        # load
        template = await self.repo.get_owned(
            center_id=center_id,
            template_id=template_id,
        )

        # remove
        await self.repo.remove_by_id(template_id)
        return MessageTemplateAtomic.deleted(template=template)
