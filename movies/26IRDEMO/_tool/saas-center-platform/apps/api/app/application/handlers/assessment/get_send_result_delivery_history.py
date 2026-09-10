from app.infrastructure.persistence.unit_of_work import UnitOfWork

from app.modules.assessment.facade import SendResultFacade
from app.modules.messaging.facade import MessagingFacade
from app.modules.messaging.messaging.schemas import MessageLogSummary


async def get_send_result_delivery_history_handler(
    center_id: str,
    case_id: str,
    send_result_id: str,
    uow: UnitOfWork,
) -> list[MessageLogSummary]:
    send_result_facade = SendResultFacade(uow)
    await send_result_facade.get_send_result(center_id, case_id, send_result_id)

    messaging_facade = MessagingFacade(uow)
    logs = await messaging_facade.get_delivery_history_by_result(send_result_id)

    return [MessageLogSummary.model_validate(log) for log in logs]


TOOL = {
    "name": "get_send_result_delivery_history_handler",
    "permission": "read:send_link",
    "purpose": "특정 검사 결과 전송의 발송(SMS·알림) 이력을 조회한다.",
    "keywords": [
        "get send result delivery history",
        "결과 발송 이력",
        "결과 전송 기록",
        "리포트 발송 내역",
        "결과 전송 이력",
        "메시지 로그",
    ],
    "boundaries": "검사 '결과'의 발송 이력(읽기 전용). 링크 발송 이력은 get_send_link_delivery_history_handler.",
    "output": "검사 결과 발송 이력 (MessageLogSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "검사 케이스",
                "description": "검사 케이스의 UUID.",
            },
            "send_result_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 결과 전송",
                "description": "발송 이력을 볼 결과 전송의 UUID.",
            },
        },
        "required": ["case_id", "send_result_id"],
    },
}
