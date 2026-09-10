from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import CenterApplicationReject, CenterApplicationResponse


async def reject_center_application_handler(
    application_id: str,
    data: CenterApplicationReject,
    reviewer_account_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    ip: str | None = None,
) -> CenterApplicationResponse:
    from app.modules.center.facade import CenterApplicationFacade

    facade = CenterApplicationFacade(uow)
    atomic, result = await facade.reject_application_with_response(
        application_id=application_id,
        reviewed_reason=data.reviewed_reason,
        reviewer_account_id=reviewer_account_id,
    )
    await emit(
        uow,
        "center_application_rejected",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=reviewer_account_id,
        actor_type="admin",
        ip_address=ip,
    )
    return result


TOOL = {
    "name": 'reject_center_application_handler',
    "permission": None,
    "agent_exposed": False,  # 온보딩/운영자 표면(admin realm)
    "purpose": '운영자가 센터 개설 신청을 반려한다.',
    "keywords": ['센터 신청 반려', '개설 거절', 'application 반려'],
    "boundaries": "운영자 전용 — 신청 '반려'. 승인은 approve_center_application_app_handler, 신청자 취소는 cancel_center_application_handler.",
    "output": '반려된 센터 개설 신청 (CenterApplicationResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'application_id': {'type': 'string', 'format': 'uuid', 'title': '대상 신청', 'description': '반려할 신청의 UUID.'},
            'reviewed_reason': {'anyOf': [{'maxLength': 500, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '반려 사유(선택).', 'title': '반려 사유'},
        },
        "required": ['application_id'],
    },
}
