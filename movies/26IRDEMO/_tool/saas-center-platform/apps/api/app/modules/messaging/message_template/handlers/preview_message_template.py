from ..schemas import MessageTemplatePreviewRequest, MessageTemplatePreviewResponse
from ...facade import MessageTemplateFacade
from app.infrastructure.persistence.unit_of_work import UnitOfWork


async def preview_message_template_handler(
    data: MessageTemplatePreviewRequest,
    uow: UnitOfWork,
) -> MessageTemplatePreviewResponse:
    facade = MessageTemplateFacade(uow)
    rendered = await facade.preview_render(data.content, data.variables)
    return MessageTemplatePreviewResponse(rendered_content=rendered)


TOOL = {
    "name": 'preview_message_template_handler',
    "permission": None,
    "purpose": '메시지 템플릿에 값을 넣어 미리보기를 생성한다.',
    "keywords": ['템플릿 미리보기', '문자 미리보기', 'preview', '발송 전 확인'],
    "boundaries": "메시지 템플릿 '미리보기'(읽기). 실제 발송은 별도 흐름.",
    "output": '값이 채워진 템플릿 미리보기 (MessageTemplatePreviewResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'content': {'title': '본문', 'type': 'string', 'description': '미리보기할 템플릿 본문(치환 변수 포함).'},
            'variables': {'additionalProperties': {'type': 'string'}, 'default': {}, 'title': '치환 변수', 'type': 'object', 'description': '변수명→값 매핑. 본문의 변수를 이 값으로 치환.'},
        },
        "required": ['content'],
    },
}
