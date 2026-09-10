from ..constants import HARDCODED_DEFAULTS, TemplateType
from ..models import MessageTemplate
from ..repository import MessageTemplateRepository


class GetDefaultTemplateService:
    def __init__(self, repo: MessageTemplateRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        template_type: str,
    ) -> tuple[MessageTemplate | None, str, str]:
        tpl_type = TemplateType(template_type)

        # load
        template = await self.repo.find_default_in_center(
            center_id=center_id,
            template_type=template_type,
        )
        if template:
            return template, template.content, "template"

        system_template = await self.repo.find_system_default(template_type=template_type)
        if system_template:
            return system_template, system_template.content, "system"

        # return
        fallback = HARDCODED_DEFAULTS.get(tpl_type, "")
        return None, fallback, "hardcoded"
