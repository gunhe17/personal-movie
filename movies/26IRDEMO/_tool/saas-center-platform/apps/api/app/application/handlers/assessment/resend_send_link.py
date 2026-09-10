from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from app.modules.assessment.facade import SendLinkFacade
from app.modules.assessment.send_link.events import SendLinkAtomic
from app.modules.assessment.send_link.schemas import (
    SendLinkRecipient,
    SendLinkResendRequest,
    SendLinkResponse,
    DeliveryResult,
)
from app.modules.center.facade import CenterFacade
from app.modules.messaging.facade import MessagingFacade, MessageTemplateFacade
from app.modules.assessment.facade import AssessmentCaseFacade

logger = get_logger(__name__)


async def resend_send_link_handler(
    center_id: str,
    case_id: str,
    send_link_id: str,
    data: SendLinkResendRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> SendLinkResponse:
    # 발송도 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentCaseFacade(uow).verify_case_writable(
        center_id, case_id, owner_scope
    )

    send_link_facade = SendLinkFacade(uow)
    send_link = await send_link_facade.get_send_link(
        center_id, case_id, send_link_id, validate_active=True
    )

    url = SendLinkFacade.build_url(send_link.id)

    center_facade = CenterFacade(uow)
    center = await center_facade.get_center(center_id)
    center_name = center.name

    recipients = [
        SendLinkRecipient(**r) for r in send_link.recipients
    ]

    if data.failed_only:
        messaging_facade = MessagingFacade(uow)
        failed_logs = await messaging_facade.get_failed_recipients(send_link_id)
        failed_phones = {log.recipient for log in failed_logs}
        recipients = [r for r in recipients if r.phone in failed_phones]
    else:
        messaging_facade = MessagingFacade(uow)

    delivery_results = []

    for recipient in recipients:
        try:
            message, template_code = await MessageTemplateFacade(uow).get_rendered_send_link_template(
                center_id=center_id,
                center_name=center_name,
                recipient_name=recipient.name,
                assessment_url=url,
               verification_code=send_link.verification_code,
                template_id=data.template_id,
            )
            msg_log = await messaging_facade.send(
                center_id=center_id,
                channel=send_link.channel,
                recipient=recipient.phone,
                message=message,
                template_code=template_code,
                send_link_id=send_link.id,
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
                f"Resend failed: channel={send_link.channel}, "
                f"recipient={recipient.phone}, error={e}",
                exc_info=True,
            )
            delivery_results.append(DeliveryResult(
                recipient_phone=recipient.phone,
                recipient_name=recipient.name,
                status="failed",
                error=str(e),
            ))

    atomic, _ = SendLinkAtomic.resent(send_link=send_link, recipient_count=len(recipients))
    await emit(
        uow,
        "assessment_send_link_resent",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return SendLinkResponse(
        id=send_link.id,
        center_id=send_link.center_id,
        case_id=send_link.case_id,
        verification_code=send_link.verification_code,
        recipients=[SendLinkRecipient(**r) for r in send_link.recipients],
        expires_at=send_link.expires_at,
        revoked_at=send_link.revoked_at,
        assessment_ids=send_link.assessment_ids,
        url=url,
        channel=send_link.channel,
        delivery_results=delivery_results,
        created_at=send_link.created_at,
        updated_at=send_link.updated_at,
    )


TOOL = {
    "name": 'resend_send_link_handler',
    "permission": "write:send_link",
    "purpose": '이미 만든 검사 응답 링크를 다시 전송한다.',
    "keywords": ['resend send link', '링크 재전송', '검사 다시 보내기', '재발송', '링크 재발급 전송', 'resend link'],
    "boundaries": "기존 '응답 링크' 재전송. 최초 생성은 create_send_link_handler.",
    "output": '재전송된 응답 링크 (SendLinkResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'case_id': {'type': 'string', 'format': 'uuid', 'title': '검사 케이스', 'description': '검사 케이스의 UUID.'},
            'send_link_id': {'type': 'string', 'format': 'uuid', 'title': '대상 응답 링크', 'description': '재전송할 응답 링크의 UUID.'},
            'failed_only': {'default': False, 'description': 'True면 실패 수신자에게만 재전송(기본 False).', 'title': '실패자만 재전송', 'type': 'boolean'},
        },
        "required": ['case_id', 'send_link_id'],
    },
}
