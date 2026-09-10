from app.core.datetime_utils import to_utc_naive
from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentCaseFacade

from app.modules.assessment.facade import SendLinkFacade
from app.modules.assessment.send_link.schemas import (
    SendLinkCreate,
    DeliveryResult,
    BulkSendLinkCreate,
    BulkSendLinkResult,
    BulkSendLinkResponse,
)
from app.modules.center.facade import CenterFacade
from app.modules.messaging.facade import MessagingFacade, MessageTemplateFacade

logger = get_logger(__name__)


async def bulk_create_send_link_handler(
    center_id: str,
    data: BulkSendLinkCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    owner_scope: str | None = None,
) -> BulkSendLinkResponse:
    if data.expires_at:
        data.expires_at = to_utc_naive(data.expires_at)

    results = []
    atomics = []
    success_count = 0
    fail_count = 0

    center_facade = CenterFacade(uow)
    center = await center_facade.get_center(center_id)
    center_name = center.name

    send_link_facade = SendLinkFacade(uow)
    messaging_facade = MessagingFacade(uow)

    case_facade = AssessmentCaseFacade(uow)

    for case_id in data.case_ids:
        try:
            # 발송도 케이스 주담당 전용 — 참여 검사자는 열람만
            await case_facade.verify_case_writable(center_id, case_id, owner_scope)

            send_link_data = SendLinkCreate(
                recipients=data.recipients,
                expires_at=data.expires_at,
                assessment_ids=data.assessment_ids,
                channel=data.channel,
            )
            send_link_atomic, send_link = await send_link_facade.create_send_link(
                center_id, case_id, send_link_data
            )

            url = SendLinkFacade.build_url(send_link.id)

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
                        f"Bulk send failed: case={case_id}, "
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

            results.append(
                BulkSendLinkResult(
                    case_id=case_id,
                    send_link_id=send_link.id,
                    status="success",
                    delivery_results=delivery_results,
                )
            )
            atomics.append(send_link_atomic)
            success_count += 1

        except Exception as e:
            logger.error(
                f"Bulk create failed: case={case_id}, error={e}",
                exc_info=True,
            )
            results.append(
                BulkSendLinkResult(
                    case_id=case_id,
                    status="failed",
                    error=str(e),
                )
            )
            fail_count += 1

    await emit(
        uow,
        "assessment_send_link_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    return BulkSendLinkResponse(
        total=len(data.case_ids),
        success_count=success_count,
        fail_count=fail_count,
        results=results,
    )


TOOL = {
    "name": "bulk_create_send_link_handler",
    "permission": "write:send_link",
    "purpose": "여러 검사 케이스에 대해 온라인 검사 응시 링크를 한꺼번에 만들어 수신자에게 문자/알림톡으로 일괄 발송한다.",
    "keywords": [
        "bulk create send link",
        "검사 링크 일괄 발송",
        "단체 검사 보내기",
        "여러 명 한번에 보내기",
        "응시 링크 대량 생성",
        "벌크 발송",
        "검사 안내 문자 일괄",
        "한꺼번에 검사 보내기",
        "케이스 여러개 링크",
    ],
    "boundaries": "여러 케이스에 응시 링크를 '한 번에' 만들어 보내는 일괄 도구다. 한 케이스에만 보낼 때는 create_send_link_handler를 쓰고, 이미 보낸 링크를 다시 보낼 때는 resend_send_link_handler를 쓴다. 검사 '결과' 전송(resend/create_send_result)과는 다르다 — 이건 응시 '링크'(응답 입력용)다.",
    "output": "일괄 링크 발송 결과 (BulkSendLinkResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_ids": {
                "description": "대상 케이스 ID 목록",
                "items": {"type": "string", "format": "uuid"},
                "minItems": 1,
                "title": "대상 케이스 목록",
                "type": "array",
            },
            "recipients": {
                "items": {"$ref": "#/$defs/SendLinkRecipient"},
                "minItems": 1,
                "title": "수신자 목록",
                "type": "array",
            },
            "expires_at": {
                "anyOf": [{"format": "date-time", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "만료 시각",
            },
            "assessment_ids": {
                "items": {"type": "string", "format": "uuid"},
                "minItems": 1,
                "title": "검사 목록",
                "type": "array",
            },
            "channel": {
                "$ref": "#/$defs/SendChannel",
                "default": "alarmtalk",
                "description": "발송 채널 (alarmtalk | sms)",
            },
        },
        "required": ["case_ids", "recipients", "assessment_ids"],
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
    },
}
