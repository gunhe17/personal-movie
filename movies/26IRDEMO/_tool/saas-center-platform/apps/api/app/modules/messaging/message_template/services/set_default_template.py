
from ..events import MessageTemplateAtomic
from ..models import MessageTemplate
from ..repository import MessageTemplateRepository


class SetDefaultTemplateService:
    def __init__(
        self,
        repo: MessageTemplateRepository,
    ):
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

        # unset
        await self.repo.unset_default(
            center_id=center_id,
            template_type=template.template_type,
        )

        # return
        updated = await self.repo.update_in_place(template_id, is_default=True)
        return MessageTemplateAtomic.updated(
            template=updated,
            changed={"is_default": True},
        )
