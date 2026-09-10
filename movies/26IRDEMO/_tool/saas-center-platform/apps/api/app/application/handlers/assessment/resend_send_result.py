from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from app.modules.assessment.facade import SendResultFacade
from app.modules.assessment.send_result.events import SendResultAtomic
from app.modules.assessment.send_result.schemas import (
    SendResultRecipient,
    SendResultResendRequest,
    SendResultResponse,
)
from app.modules.assessment.send_link.schemas import DeliveryResult
from app.modules.center.facade import CenterFacade
from app.modules.messaging.facade import MessagingFacade
from app.modules.messaging.facade import MessageTemplateFacade
from app.modules.assessment.facade import AssessmentCaseFacade

logger = get_logger(__name__)


async def resend_send_result_handler(
    center_id: str,
    case_id: str,
    send_result_id: str,
    data: SendResultResendRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> SendResultResponse:
    # 발송도 케이스 주담당 전용 — 참여 검사자는 열람만
    await AssessmentCaseFacade(uow).verify_case_writable(
        center_id, case_id, owner_scope
    )

    send_result_facade = SendResultFacade(uow)
    send_result = await send_result_facade.get_send_result(
        center_id, case_id, send_result_id, validate_active=True
    )

    url = SendResultFacade.build_url(send_result.id)

    center_facade = CenterFacade(uow)
    center = await center_facade.get_center(center_id)
    center_name = center.name

    recipients = [
        SendResultRecipient(**r) for r in send_result.recipients
    ]

    messaging_facade = MessagingFacade(uow)
    msg_template_facade = MessageTemplateFacade(uow)

    if data.failed_only:
        failed_logs = await messaging_facade.get_failed_recipients_by_result(
            send_result_id
        )
        failed_phones = {log.recipient for log in failed_logs}
        recipients = [r for r in recipients if r.phone in failed_phones]

    delivery_results = []

    for recipient in recipients:
        message, template_code = await msg_template_facade.get_rendered_template(
            center_id=center_id,
            template_type="assessment_result_send",
            variables={
                "center_name": center_name,
                "recipient_name": recipient.name,
                "result_url": url,
                "verification_code": send_result.verification_code,
            },
        )

        try:
            msg_log = await messaging_facade.send(
                center_id=center_id,
                channel=send_result.channel,
                recipient=recipient.phone,
                message=message,
                template_code=template_code,
                send_result_id=send_result.id,
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
                f"Resend result failed: channel={send_result.channel}, "
                f"recipient={recipient.phone}, error={e}",
                exc_info=True,
            )
            delivery_results.append(DeliveryResult(
                recipient_phone=recipient.phone,
                recipient_name=recipient.name,
                status="failed",
                error=str(e),
            ))

    atomic, _ = SendResultAtomic.resent(send_result=send_result, recipient_count=len(recipients))
    await emit(
        uow,
        "assessment_send_result_resent",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return SendResultResponse(
        id=send_result.id,
        center_id=send_result.center_id,
        case_id=send_result.case_id,
        verification_code=send_result.verification_code,
        recipients=[SendResultRecipient(**r) for r in send_result.recipients],
        expires_at=send_result.expires_at,
        revoked_at=send_result.revoked_at,
        url=url,
        channel=send_result.channel,
        delivery_results=delivery_results,
        created_at=send_result.created_at,
        updated_at=send_result.updated_at,
    )


TOOL = {
    "name": 'resend_send_result_handler',
    "permission": "write:send_link",
    "purpose": '이미 보낸 검사 결과를 다시 전송한다.',
    "keywords": ['resend send result', '결과 재전송', '리포트 다시 보내기', '결과 재발송', 'resend result'],
    "boundaries": "기존 '결과 전송' 재전송. 최초 전송은 create_send_result_handler.",
    "output": '재전송된 검사 결과 (SendResultResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'case_id': {'type': 'string', 'format': 'uuid', 'title': '검사 케이스', 'description': '검사 케이스의 UUID.'},
            'send_result_id': {'type': 'string', 'format': 'uuid', 'title': '대상 결과 전송', 'description': '재전송할 결과 전송의 UUID.'},
            'failed_only': {'default': False, 'description': 'True면 실패 수신자에게만 재전송(기본 False).', 'title': '실패자만 재전송', 'type': 'boolean'},
        },
        "required": ['case_id', 'send_result_id'],
    },
}
