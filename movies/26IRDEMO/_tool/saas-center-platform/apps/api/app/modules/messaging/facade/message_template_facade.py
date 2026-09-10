from app.infrastructure.persistence.new_repository import single_page
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..message_template.constants import (
    HARDCODED_DEFAULTS,
    HARDCODED_TEMPLATE_CODES,
    TemplateType,
)
from ..message_template.models import MessageTemplate
from ..message_template.repository import MessageTemplateRepository
from ..message_template.schemas import (
    DefaultTemplateResponse,
    MessageTemplateListResponse,
    MessageTemplateResponse,
    MessageTemplateSummary,
)
from ..message_template.services.create_message_template import CreateMessageTemplateService
from ..message_template.services.update_message_template import UpdateMessageTemplateService
from ..message_template.services.delete_message_template import DeleteMessageTemplateService
from ..message_template.services.list_message_templates import ListMessageTemplatesService
from ..message_template.services.set_default_template import SetDefaultTemplateService
from ..message_template.services.get_default_template import GetDefaultTemplateService
from ..message_template.services.find_message_template import FindMessageTemplateService
from ..message_template.services.render_template import RenderTemplateService
from ..message_template.events import MessageTemplateAtomic


class MessageTemplateFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> MessageTemplateRepository:
        return self._uow.repo(MessageTemplateRepository)

    async def get_rendered_send_link_template(
        self,
        *,
        center_id: str,
        center_name: str,
        recipient_name: str,
        assessment_url: str,
        verification_code: str,
        template_id: str | None = None,
    ) -> tuple[str, str | None]:
        from app.core.exceptions import InvalidOperationException

        variables = {
            "center_name": center_name,
            "recipient_name": recipient_name,
            "assessment_url": assessment_url,
            "verification_code": verification_code,
        }
        if template_id == "__builtin__":
            message = RenderTemplateService.execute(
                HARDCODED_DEFAULTS[TemplateType.ASSESSMENT_SEND_LINK], variables
            )
            template_code = HARDCODED_TEMPLATE_CODES[TemplateType.ASSESSMENT_SEND_LINK]
        elif template_id is not None:
            template = await FindMessageTemplateService(self._repo()).execute_accessible(center_id, template_id)
            if template is None or template.template_type != TemplateType.ASSESSMENT_SEND_LINK.value:
                raise InvalidOperationException("선택한 검사 링크 전송 양식을 사용할 수 없습니다. 양식을 다시 선택해주세요.")
            message = RenderTemplateService.execute(template.content, variables)
            template_code = HARDCODED_TEMPLATE_CODES[TemplateType.ASSESSMENT_SEND_LINK]
        else:
            message, template_code = await self.get_rendered_template(
                center_id=center_id,
                template_type=TemplateType.ASSESSMENT_SEND_LINK.value,
                variables=variables,
            )
        if assessment_url not in message or verification_code not in message:
            raise InvalidOperationException(
                "검사 링크 전송 양식에 검사 링크와 인증번호가 필요합니다. 메시지 양식 설정을 확인해주세요."
            )
        return message, template_code

    async def find_template(
        self, center_id: str | None, template_id: str
    ) -> MessageTemplate | None:
        service = FindMessageTemplateService(self._repo())
        return await service.execute(center_id, template_id)


    async def list_templates(
        self, center_id: str, template_type: str | None = None
    ) -> list[MessageTemplate]:
        service = ListMessageTemplatesService(self._repo())
        return await service.execute(center_id, template_type)

    async def list_system_templates(
        self, template_type: str | None = None
    ) -> list[MessageTemplate]:
        service = ListMessageTemplatesService(self._repo())
        return await service.execute_system(template_type)

    async def list_center_only_templates(
        self, center_id: str, template_type: str | None = None
    ) -> list[MessageTemplate]:
        service = ListMessageTemplatesService(self._repo())
        return await service.execute_center_only(center_id, template_type)

    async def get_default_template(
        self, center_id: str, template_type: str
    ) -> tuple[MessageTemplate | None, str, str]:
        service = GetDefaultTemplateService(self._repo())
        return await service.execute(center_id, template_type)

    async def set_default(
        self, center_id: str | None, template_id: str
    ) -> tuple[MessageTemplateAtomic, MessageTemplate]:
        service = SetDefaultTemplateService(self._repo())
        return await service.execute(center_id, template_id)

    async def delete_template(
        self, center_id: str | None, template_id: str
    ) -> tuple[MessageTemplateAtomic, MessageTemplate]:
        service = DeleteMessageTemplateService(self._repo())
        return await service.execute(center_id, template_id)

    async def preview_render(
        self, content: str, variables: dict[str, str]
    ) -> str:
        return RenderTemplateService.execute(content, variables)

    async def create_template(
        self,
        center_id: str | None,
        template_type: str,
        name: str,
        content: str,
        is_default: bool = False,
    ) -> tuple[MessageTemplateAtomic, MessageTemplate]:
        service = CreateMessageTemplateService(self._repo())
        return await service.execute(
            center_id=center_id,
            template_type=template_type,
            name=name,
            content=content,
            is_default=is_default,
        )

    async def update_template(
        self,
        center_id: str | None,
        template_id: str,
        changed: dict,
        name: str | None = None,
        content: str | None = None,
    ) -> tuple[MessageTemplateAtomic, MessageTemplate]:
        service = UpdateMessageTemplateService(self._repo())
        return await service.execute(
            center_id=center_id,
            template_id=template_id,
            changed=changed,
            name=name,
            content=content,
        )

    async def list_templates_with_response(
        self, center_id: str, template_type: str | None = None
    ) -> MessageTemplateListResponse:
        templates = await self.list_templates(center_id, template_type)
        items = [MessageTemplateSummary.model_validate(t) for t in templates]
        return MessageTemplateListResponse(items=items, **single_page(items))

    async def list_system_templates_with_response(
        self, template_type: str | None = None
    ) -> MessageTemplateListResponse:
        templates = await self.list_system_templates(template_type)
        items = [MessageTemplateSummary.model_validate(t) for t in templates]
        return MessageTemplateListResponse(items=items, **single_page(items))

    async def list_center_only_templates_with_response(
        self, center_id: str, template_type: str | None = None
    ) -> MessageTemplateListResponse:
        templates = await self.list_center_only_templates(center_id, template_type)
        items = [MessageTemplateSummary.model_validate(t) for t in templates]
        return MessageTemplateListResponse(items=items, **single_page(items))

    async def get_template_with_response(
        self, center_id: str | None, template_id: str
    ) -> MessageTemplateResponse:
        from app.core.exceptions import EntityNotFoundException

        template = await self.find_template(center_id, template_id)
        if not template:
            raise EntityNotFoundException(f"양식을 찾을 수 없습니다: {template_id}")
        return MessageTemplateResponse.model_validate(template)

    async def get_default_template_with_response(
        self, center_id: str, template_type: str
    ) -> DefaultTemplateResponse:
        template, fallback_content, source = await self.get_default_template(
            center_id, template_type
        )
        return DefaultTemplateResponse(
            template=MessageTemplateResponse.model_validate(template) if template else None,
            fallback_content=fallback_content,
            builtin_content=HARDCODED_DEFAULTS.get(TemplateType(template_type), ""),
            source=source,
        )

    async def get_accessible_template_with_response(
        self, center_id: str, template_id: str
    ) -> MessageTemplateResponse:
        from app.core.exceptions import EntityNotFoundException

        service = FindMessageTemplateService(self._repo())
        template = await service.execute_accessible(center_id, template_id)
        if not template:
            raise EntityNotFoundException(f"양식을 찾을 수 없습니다: {template_id}")
        return MessageTemplateResponse.model_validate(template)

    async def get_rendered_template(
        self,
        center_id: str,
        template_type: str,
        variables: dict[str, str],
        template_id: str | None = None,
    ) -> tuple[str, str | None]:
        get_service = FindMessageTemplateService(self._repo())
        tpl_type = TemplateType(template_type)

        content: str | None = None
        template_code: str | None = HARDCODED_TEMPLATE_CODES.get(tpl_type)

        if template_id:
            template = await get_service.execute(center_id, template_id)
            if template:
                content = template.content

        if content is None:
            template = await get_service.find_default(center_id, template_type)
            if template:
                content = template.content

        if content is None:
            system_tpl = await get_service.find_system_default(template_type)
            if system_tpl:
                content = system_tpl.content

        if content is None:
            content = HARDCODED_DEFAULTS.get(tpl_type, "")

        rendered = RenderTemplateService.execute(content, variables)
        return rendered, template_code
