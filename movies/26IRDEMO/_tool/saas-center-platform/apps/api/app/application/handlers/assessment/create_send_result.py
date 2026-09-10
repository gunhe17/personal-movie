from app.core.datetime_utils import to_utc_naive
from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from app.modules.assessment.facade import (
    AssessmentSessionFacade,
    AssessmentTaskFacade,
    SendResultFacade,
)
from app.modules.assessment.send_result.schemas import (
    SendResultCreate,
    SendResultResponse,
)
from app.modules.assessment.send_link.schemas import DeliveryResult
from app.modules.center.facade import CenterFacade
from app.modules.messaging.facade import MessagingFacade
from app.modules.messaging.facade import MessageTemplateFacade
from app.modules.assessment.facade import AssessmentCaseFacade

logger = get_logger(__name__)


async def create_send_result_handler(
    center_id: str,
    case_id: str,
    data: SendResultCreate,
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

    data.expires_at = to_utc_naive(data.expires_at)

    send_result_facade = SendResultFacade(uow)
    atomic, send_result = await send_result_facade.create_send_result(
        center_id, case_id, data
    )
    await emit(
        uow,
        "assessment_send_result_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    # 결과 전송 = 보호자에게 결과를 여는 행위 → 앱 열람 게이트(G3)도 같이 연다.
    # 보호자 인앱 알림·푸시는 반응(notify_assessment_send_result_created)이 워커에서 처리
    await AssessmentTaskFacade(uow).mark_reports_visible_to_guardian(case_id)

    url = SendResultFacade.build_url(send_result.id)

    messaging_facade = MessagingFacade(uow)
    msg_template_facade = MessageTemplateFacade(uow)

    center_facade = CenterFacade(uow)
    center = await center_facade.get_center(center_id)
    center_name = center.name

    reservation_date = await _resolve_reservation_date(uow, case_id)

    delivery_results = []

    for recipient in data.recipients:
        variables: dict[str, str] = {
            "center_name": center_name,
            "recipient_name": recipient.name,
            "result_url": url,
            "verification_code": send_result.verification_code,
        }
        if reservation_date:
            variables["reservation_date"] = reservation_date

        message, template_code = await msg_template_facade.get_rendered_template(
            center_id=center_id,
            template_type="assessment_result_send",
            variables=variables,
            template_id=data.template_id,
        )

        try:
            msg_log = await messaging_facade.send(
                center_id=center_id,
                channel=data.channel.value,
                recipient=recipient.phone,
                message=message,
                template_code=template_code,
                title=f"[{center_name}] 검사 결과 안내",
                send_result_id=send_result.id,
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
                f"Result send failed: channel={data.channel.value}, "
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

    return SendResultResponse(
        id=send_result.id,
        center_id=send_result.center_id,
        case_id=send_result.case_id,
        verification_code=send_result.verification_code,
        recipients=data.recipients,
        expires_at=send_result.expires_at,
        revoked_at=send_result.revoked_at,
        url=url,
        channel=data.channel,
        delivery_results=delivery_results,
        created_at=send_result.created_at,
        updated_at=send_result.updated_at,
    )


async def _resolve_reservation_date(uow: UnitOfWork, case_id: str) -> str | None:
    try:
        from app.modules.schedule.facade import ScheduleFacade

        sessions = await AssessmentSessionFacade(uow).list_sessions_by_case(case_id)
        if not sessions:
            return None

        # schedule은 owning facade 경유로 조회
        schedule_id = sessions[0].schedule_id
        if not schedule_id:
            return None

        schedules = await ScheduleFacade(uow).list_schedules_by_ids([schedule_id])
        schedule = schedules[0] if schedules else None
        if not schedule or not schedule.start:
            return None

        from datetime import timedelta

        kst = schedule.start + timedelta(hours=9)  # KST = UTC+9
        days = ["월", "화", "수", "목", "금", "토", "일"]
        day_name = days[kst.weekday()]
        return kst.strftime(f"%Y-%m-%d({day_name}) %H:%M")
    except Exception as e:
        logger.warning(f"Failed to resolve reservation date for case {case_id}: {e}")
        return None


TOOL = {
    "name": "create_send_result_handler",
    "permission": "write:send_link",
    "purpose": "완료된 검사 결과를 내담자·보호자에게 전송한다.",
    "keywords": [
        "create send result",
        "검사 결과 전송",
        "결과 보내기",
        "리포트 발송",
        "결과 공유",
        "검사 리포트 전송",
        "send result",
    ],
    "boundaries": "검사 '결과/리포트'를 보낸다. 응답용 링크는 create_send_link_handler. 재전송은 resend_send_result_handler, 검증은 verify_send_result_handler.",
    "output": "전송된 검사 결과 (SendResultResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "결과를 전송할 검사 케이스의 UUID.",
            },
            "recipients": {
                "items": {"$ref": "#/$defs/SendResultRecipient"},
                "minItems": 1,
                "title": "수신자 목록",
                "type": "array",
                "description": "결과를 받을 수신자(이름·전화) 목록(최소 1명).",
            },
            "expires_at": {
                "anyOf": [{"format": "date-time", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "만료 일시",
                "description": "열람 만료 일시(선택).",
            },
            "channel": {
                "$ref": "#/$defs/SendChannel",
                "default": "alarmtalk",
                "description": "발송 채널: alarmtalk(알림톡)/sms(기본 alarmtalk).",
            },
            "template_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "문자 양식 UUID(미지정 시 기본 양식).",
                "title": "문자 양식",
            },
        },
        "$defs": {
            "SendChannel": {
                "enum": ["alarmtalk", "sms"],
                "title": "SendChannel",
                "type": "string",
            },
            "SendResultRecipient": {
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
                "title": "SendResultRecipient",
                "type": "object",
            },
        },
        "required": ["case_id", "recipients"],
    },
}
