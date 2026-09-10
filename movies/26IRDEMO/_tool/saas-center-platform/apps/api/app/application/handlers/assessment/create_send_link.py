from app.core.datetime_utils import to_utc_naive
from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from app.modules.assessment.facade import SendLinkFacade
from app.modules.assessment.send_link.schemas import (
    SendLinkCreate,
    SendLinkResponse,
    DeliveryResult,
)
from app.modules.center.facade import CenterFacade
from app.modules.messaging.facade import MessagingFacade, MessageTemplateFacade
from app.modules.assessment.facade import AssessmentCaseFacade

logger = get_logger(__name__)


async def create_send_link_handler(
    center_id: str,
    case_id: str,
    data: SendLinkCreate,
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

    data.expires_at = to_utc_naive(data.expires_at)

    send_link_facade = SendLinkFacade(uow)
    atomic, send_link = await send_link_facade.create_send_link(
        center_id, case_id, data
    )
    await emit(
        uow,
        "assessment_send_link_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    url = SendLinkFacade.build_url(send_link.id)

    messaging_facade = MessagingFacade(uow)

    center_facade = CenterFacade(uow)
    center = await center_facade.get_center(center_id)
    center_name = center.name

    delivery_results = []

    for recipient in data.recipients:
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
                channel=data.channel.value,
                recipient=recipient.phone,
                message=message,
                template_code=template_code,
                title=f"[{center_name}] 검사 안내",
                send_link_id=send_link.id,
            )

            delivery_results.append(
                DeliveryResult(
                    recipient_phone=recipient.phone,
                    recipient_name=recipient.name,
                    status=msg_log.status.value,
                    message_id=msg_log.id,
                    error=msg_log.error_message,
                )
            )
        except Exception as e:
            logger.error(
                f"Message send failed: channel={data.channel.value}, "
                f"recipient={recipient.phone}, error={e}",
                exc_info=True,
            )
            delivery_results.append(
                DeliveryResult(
                    recipient_phone=recipient.phone,
                    recipient_name=recipient.name,
                    status="failed",
                    error=str(e),
                )
            )

    return SendLinkResponse(
        id=send_link.id,
        center_id=send_link.center_id,
        case_id=send_link.case_id,
        verification_code=send_link.verification_code,
        recipients=data.recipients,
        expires_at=send_link.expires_at,
        revoked_at=send_link.revoked_at,
        assessment_ids=send_link.assessment_ids,
        url=url,
        channel=data.channel,
        delivery_results=delivery_results,
        created_at=send_link.created_at,
        updated_at=send_link.updated_at,
    )


TOOL = {
    "name": "create_send_link_handler",
    "permission": "write:send_link",
    "purpose": "검사 케이스에 대해 내담자가 응답할 검사 링크를 생성한다.",
    "keywords": [
        "create send link",
        "검사 링크 생성",
        "응답 링크 발송",
        "검사 보내기",
        "링크 만들기",
        "온라인 검사 전송",
        "send link",
    ],
    "boundaries": "내담자 '응답용' 링크 생성. 검사 '결과'를 보내는 건 create_send_result_handler. 여러 건 일괄은 bulk_create_send_link_handler, 재전송은 resend_send_link_handler.",
    "output": "생성된 응답 링크 (SendLinkResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "링크를 발급할 검사 케이스의 UUID.",
            },
            "recipients": {
                "items": {"$ref": "#/$defs/SendLinkRecipient"},
                "minItems": 1,
                "title": "수신자 목록",
                "type": "array",
                "description": "링크를 받을 수신자(이름·전화) 목록(최소 1명).",
            },
            "expires_at": {
                "anyOf": [{"format": "date-time", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "만료 일시",
                "description": "링크 만료 일시(선택).",
            },
            "assessment_ids": {
                "items": {"type": "string"},
                "minItems": 1,
                "title": "검사 목록",
                "type": "array",
                "description": "응답받을 검사 UUID 목록(최소 1개).",
            },
            "channel": {
                "$ref": "#/$defs/SendChannel",
                "default": "alarmtalk",
                "description": "발송 채널 (alarmtalk | sms)",
            },
        },
        "$defs": {
            "SendChannel": {
                "enum": ["alarmtalk", "sms"],
                "title": "SendChannel",
                "type": "string",
            },
            "SendLinkRecipient": {
                "properties": {
                    "name": {"title": "Name", "type": "string"},
                    "phone": {"title": "Phone", "type": "string"},
                    "relation": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "title": "Relation",
                    },
                },
                "required": ["name", "phone"],
                "title": "SendLinkRecipient",
                "type": "object",
            },
        },
        "required": ["case_id", "recipients", "assessment_ids"],
    },
}
