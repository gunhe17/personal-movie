from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import CenterApplicationResponse


async def cancel_center_application_handler(
    application_id: str,
    account_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> CenterApplicationResponse:
    from app.modules.center.facade import CenterApplicationFacade

    facade = CenterApplicationFacade(uow)
    atomic, result = await facade.cancel_application_with_response(
        application_id=application_id,
        account_id=account_id,
    )
    await emit(
        uow,
        "center_application_cancelled",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": "cancel_center_application_handler",
    "permission": None,
    "agent_exposed": False,  # 온보딩/운영자 표면(admin realm)
    "purpose": "센터 개설 신청을 취소한다.",
    "keywords": ["센터 신청 취소", "개설 취소", "application 취소"],
    "boundaries": "신청자가 자기 센터 개설 신청을 '취소'. 반려(운영자)는 reject_center_application_handler.",
    "output": "취소된 센터 개설 신청 (CenterApplicationResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "application_id": {"type": "string", "format": "uuid", "title": "대상 신청", "description": "취소할 센터 개설 신청의 UUID."},
        },
        "required": ["application_id"],
    },
}
