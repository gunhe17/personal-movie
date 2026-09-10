
from ..models import MessageTemplate
from ..repository import MessageTemplateRepository
from ..events import MessageTemplateAtomic


class UpdateMessageTemplateService:
    def __init__(self, repo: MessageTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str | None,
        template_id: str,
        changed: dict,
        name: str | None = None,
        content: str | None = None,
    ) -> tuple[MessageTemplateAtomic, MessageTemplate]:
        # load
        template = await self.repo.get_owned(
            center_id=center_id,
            template_id=template_id,
        )

        # build
        update_data = {}
        if name is not None:
            update_data["name"] = name
        if content is not None:
            update_data["content"] = content

        # return
        if update_data:
            updated = await self.repo.update_in_place(template_id, **update_data)
            return MessageTemplateAtomic.updated(template=updated, changed=changed)

        return MessageTemplateAtomic.updated(template=template, changed=changed)
