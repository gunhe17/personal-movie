from ..models import MessageTemplate
from ..repository import MessageTemplateRepository


class FindMessageTemplateService:
    def __init__(self, repo: MessageTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str | None,
        template_id: str,
    ) -> MessageTemplate | None:
        # return
        return await self.repo.find_owned(
            center_id=center_id,
            template_id=template_id,
        )

    async def execute_accessible(
        self,
        center_id: str,
        template_id: str,
    ) -> MessageTemplate | None:
        # return
        return await self.repo.find_accessible(
            center_id=center_id,
            template_id=template_id,
        )

    async def find_default(
        self,
        center_id: str,
        template_type: str,
    ) -> MessageTemplate | None:
        # return
        return await self.repo.find_default_in_center(
            center_id=center_id,
            template_type=template_type,
        )

    async def find_system_default(
        self,
        template_type: str,
    ) -> MessageTemplate | None:
        # return
        return await self.repo.find_system_default(template_type=template_type)
