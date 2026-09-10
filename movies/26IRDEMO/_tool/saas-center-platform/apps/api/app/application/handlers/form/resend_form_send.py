from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from app.modules.form.facade import FormSendFacade
from app.modules.form.send.events import FormSendAtomic
from app.modules.form.send.schemas import (
    FormSendRecipient,
    FormSendResendRequest,
    FormSendResponse,
    SendChannel,
    DeliveryResult,
)
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.center.facade import CenterFacade
from app.modules.messaging.facade import MessagingFacade
from app.modules.messaging.facade import MessageTemplateFacade

logger = get_logger(__name__)


async def resend_form_send_handler(
    center_id: str,
    send_id: str,
    data: FormSendResendRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> FormSendResponse:
    form_send_facade = FormSendFacade(uow)
    form_send = await form_send_facade.get_form_send(center_id, send_id)

    template_facade = FormTemplateFacade(uow)
    template = await template_facade.get_template(
        form_send.form_template_id, center_id
    )
    form_name = template.name

    center_facade = CenterFacade(uow)
    center = await center_facade.get_center(center_id)
    center_name = center.name

    recipients = [FormSendRecipient(**r) for r in form_send.recipients]
    channel = form_send.channel

    messaging_facade = MessagingFacade(uow)
    msg_template_facade = MessageTemplateFacade(uow)

    # failed_only: 직전 발송이 실패한 수신자만 (form_send_id로 연결된 MessageLog 기준)
    if data.failed_only:
        failed_logs = await messaging_facade.get_failed_recipients_by_form_send(send_id)
        failed_phones = {log.recipient for log in failed_logs}
        recipients = [r for r in recipients if r.phone in failed_phones]

    delivery_results: list[DeliveryResult] = []

    for recipient in recipients:
        url = (
            FormSendFacade.build_url(recipient.instance_id)
            if recipient.instance_id
            else center_name
        )
        message, template_code = await msg_template_facade.get_rendered_template(
            center_id=center_id,
            template_type="form_fill_request",
            variables={
                "center_name": center_name,
                "recipient_name": recipient.name,
                "form_name": form_name,
                "form_url": url,
            },
        )

        try:
            msg_log = await messaging_facade.send(
                center_id=center_id,
                channel=channel,
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
                f"Form resend failed: channel={channel}, "
                f"recipient={recipient.phone}, error={e}",
                exc_info=True,
            )
            delivery_results.append(DeliveryResult(
                recipient_phone=recipient.phone,
                recipient_name=recipient.name,
                status="failed",
                error=str(e),
            ))

    atomic, _ = FormSendAtomic.resent(form_send=form_send, recipient_count=len(recipients))
    await emit(
        uow,
        "form_send_resent",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return FormSendResponse(
        id=form_send.id,
        center_id=form_send.center_id,
        form_template_id=form_send.form_template_id,
        recipients=recipients,
        channel=SendChannel(channel),
        delivery_results=delivery_results,
        created_at=form_send.created_at,
        updated_at=form_send.updated_at,
    )


TOOL = {
    "name": 'resend_form_send_handler',
    "permission": "write:form_instance",
    "purpose": '이미 보낸 폼 발송을 다시 보낸다.',
    "keywords": ['resend form send', '폼 재발송', '설문 다시 보내기', '양식 재전송', 'resend form'],
    "boundaries": '기존 폼 발송 재전송. 최초 발송은 create_form_send_handler.',
    "output": '재발송된 폼 발송 (FormSendResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'send_id': {'type': 'string', 'format': 'uuid', 'title': '대상 발송', 'description': '재발송할 폼 발송 건의 UUID.'},
            'failed_only': {'default': False, 'description': 'True면 직전 발송이 실패한 수신자에게만 재전송(기본 False).', 'title': '실패자만 재전송', 'type': 'boolean'},
        },
        "required": ['send_id'],
    },
}
