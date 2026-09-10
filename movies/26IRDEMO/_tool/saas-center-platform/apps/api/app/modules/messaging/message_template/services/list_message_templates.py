from ..models import MessageTemplate
from ..repository import MessageTemplateRepository


class ListMessageTemplatesService:
    def __init__(self, repo: MessageTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        template_type: str | None = None,
    ) -> list[MessageTemplate]:
        # load
        center_templates = await self.repo.list_in_center(
            center_id=center_id,
            template_type=template_type,
        )
        system_templates = await self.repo.list_system(template_type=template_type)

        # return
        return center_templates + system_templates

    async def execute_system(
        self,
        template_type: str | None = None,
    ) -> list[MessageTemplate]:
        # return
        return await self.repo.list_system(template_type=template_type)

    async def execute_center_only(
        self,
        center_id: str,
        template_type: str | None = None,
    ) -> list[MessageTemplate]:
        # return
        return await self.repo.list_in_center(
            center_id=center_id,
            template_type=template_type,
        )
