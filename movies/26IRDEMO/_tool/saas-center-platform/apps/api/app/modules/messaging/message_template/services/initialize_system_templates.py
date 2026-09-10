from app.core.logger import get_logger

from ..constants import (
    TemplateType,
    TEMPLATE_TYPE_NAMES,
    TEMPLATE_TYPE_VARIABLES,
    HARDCODED_DEFAULTS,
)
from ..events import MessageTemplateAtomic
from ..repository import MessageTemplateRepository

logger = get_logger(__name__)


class InitializeSystemTemplatesService:
    def __init__(
        self,
        repo: MessageTemplateRepository,
    ):
        self.repo = repo

    async def execute(self) -> tuple[list[MessageTemplateAtomic], int]:
        # load
        existing_types = {t.template_type for t in await self.repo.list_system()}

        # create
        atomics: list[MessageTemplateAtomic] = []
        for template_type in TemplateType:
            if template_type.value in existing_types:
                continue

            name = TEMPLATE_TYPE_NAMES.get(template_type)
            content = HARDCODED_DEFAULTS.get(template_type)
            if not name or not content:
                continue

            var_defs = TEMPLATE_TYPE_VARIABLES.get(template_type, [])
            template = await self.repo.add(
                center_id=None,
                template_type=template_type.value,
                name=name,
                content=content,
                variables=[v.to_dict() for v in var_defs],
                is_default=True,
            )
            atomic, _ = MessageTemplateAtomic.created(template=template)
            atomics.append(atomic)

        # return
        created = len(atomics)
        if created > 0:
            logger.info(f"시스템 기본 문자 양식 {created}개 생성")
        else:
            logger.info("시스템 기본 문자 양식 확인 완료 (변경 없음)")
        return atomics, created
