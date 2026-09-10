from ..constants import TEMPLATE_TYPE_VARIABLES, TemplateType
from ..models import MessageTemplate
from ..repository import MessageTemplateRepository
from ..events import MessageTemplateAtomic


class CreateMessageTemplateService:
    def __init__(self, repo: MessageTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str | None,
        template_type: str,
        name: str,
        content: str,
        is_default: bool = False,
    ) -> tuple[MessageTemplateAtomic, MessageTemplate]:
        # unset
        if is_default:
            await self.repo.unset_default(
                center_id=center_id,
                template_type=template_type,
            )

        # build
        tpl_type = TemplateType(template_type)
        var_defs = TEMPLATE_TYPE_VARIABLES.get(tpl_type, [])
        variables = [v.to_dict() for v in var_defs]

        # return
        template = await self.repo.add(
            center_id=center_id,
            template_type=template_type,
            name=name,
            content=content,
            variables=variables,
            is_default=is_default,
        )
        return MessageTemplateAtomic.created(template=template)
