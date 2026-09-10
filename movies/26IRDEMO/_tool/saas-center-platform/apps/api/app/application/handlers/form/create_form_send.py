from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from app.modules.form.facade import FormSendFacade
from app.modules.form.send.schemas import (
    FormSendCreate,
    FormSendResponse,
    DeliveryResult,
)
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.center.facade import CenterFacade
from app.modules.messaging.facade import MessagingFacade
from app.modules.messaging.facade import MessageTemplateFacade

logger = get_logger(__name__)


async def create_form_send_handler(
    center_id: str,
    template_id: str,
    data: FormSendCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> FormSendResponse:
    template_facade = FormTemplateFacade(uow)
    template = await template_facade.get_template(template_id, center_id)
    form_name = template.name

    center_facade = CenterFacade(uow)
    center = await center_facade.get_center(center_id)
    center_name = center.name

    form_facade = FormFacade(uow)
    instance_atomics = []
    codes: dict[str, str] = {}
    for recipient in data.recipients:
        code = FormSendFacade.new_verification_code()
        atomic, instance = await form_facade.create_instance(
            center_id, template_id, verification_code=code
        )
        instance_atomics.append(atomic)
        recipient.instance_id = instance.id
        recipient.status = instance.status
        codes[instance.id] = code

    form_send_facade = FormSendFacade(uow)
    send_atomic, form_send = await form_send_facade.create_form_send(
        center_id, template_id, data
    )

    # 발송 생성 = form_send + 태어난 인스턴스들이 한 워크플로의 사실(instance atomic 수집)
    await emit(
        uow,
        "form_send_created",
        event_group_id=event_group_id,
        atomics=[send_atomic, *instance_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )

    messaging_facade = MessagingFacade(uow)
    msg_template_facade = MessageTemplateFacade(uow)

    delivery_results: list[DeliveryResult] = []

    for recipient in data.recipients:
        url = FormSendFacade.build_url(recipient.instance_id)
        message, template_code = await msg_template_facade.get_rendered_template(
            center_id=center_id,
            template_type="form_fill_request",
            variables={
                "center_name": center_name,
                "recipient_name": recipient.name,
                "form_name": form_name,
                "form_url": url,
                "verification_code": codes.get(recipient.instance_id, ""),
            },
            template_id=data.template_id,
        )

        try:
            msg_log = await messaging_facade.send(
                center_id=center_id,
                channel=data.channel.value,
                recipient=recipient.phone,
                message=message,
                template_code=template_code,
                title=f"[{center_name}] 문서 작성 요청",
                form_send_id=form_send.id,
            )

            delivery_results.append(DeliveryResult(
                recipient_phone=recipient.phone,
                recipient_name=recipient.name,
                status=msg_log.status.value,
                message_id=msg_log.id,
                error=msg_log.error_message,
            ))
        except Exception as e:
            logger.error(
                f"Form send failed: channel={data.channel.value}, "
                f"recipient={recipient.phone}, error={e}",
                exc_info=True,
            )
            delivery_results.append(DeliveryResult(
                recipient_phone=recipient.phone,
                recipient_name=recipient.name,
                status="failed",
                error=str(e),
            ))


    return FormSendResponse(
        id=form_send.id,
        center_id=form_send.center_id,
        form_template_id=form_send.form_template_id,
        recipients=data.recipients,
        channel=data.channel,
        delivery_results=delivery_results,
        created_at=form_send.created_at,
        updated_at=form_send.updated_at,
    )


TOOL = {
    "name": 'create_form_send_handler',
    "permission": "write:form_instance",
    "purpose": '폼(설문) 템플릿으로 발송 건을 생성해 대상에게 보낸다.',
    "keywords": ['create form send', '폼 발송', '설문 보내기', '양식 전송', 'form 발송', '설문 발송 생성'],
    "boundaries": "폼 발송 건을 '생성'한다. 발송 목록은 list_form_sends_enriched_handler, 재발송은 resend_form_send_handler.",
    "output": '생성된 폼 발송 건 (FormSendResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'template_id': {'type': 'string', 'format': 'uuid', 'title': '폼 템플릿', 'description': '발송할 폼 템플릿의 UUID.'},
            'recipients': {'items': {'$ref': '#/$defs/FormSendRecipient'}, 'minItems': 1, 'title': '수신자 목록', 'type': 'array', 'description': '폼을 받을 수신자(이름·전화) 목록(최소 1명).'},
            'channel': {'$ref': '#/$defs/SendChannel', 'default': 'sms', 'description': '발송 채널: alarmtalk(알림톡)/sms(기본 sms).'},
        },
        "$defs": {'FormSendRecipient': {'properties': {'name': {'title': 'Name', 'type': 'string'}, 'phone': {'title': 'Phone', 'type': 'string'}, 'relation': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Relation'}, 'instance_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Instance Id'}, 'status': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Status'}}, 'required': ['name', 'phone'], 'title': 'FormSendRecipient', 'type': 'object'}, 'SendChannel': {'enum': ['alarmtalk', 'sms'], 'title': 'SendChannel', 'type': 'string'}},
        "required": ['template_id', 'recipients'],
    },
}
