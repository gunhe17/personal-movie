from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.inquiry.repository import InquiryRepository
from app.modules.platform_admin.inquiry.services.update_inquiry_status import UpdateInquiryStatusService
from app.modules.platform_admin.qna.schemas import InquiryStatusRequest, InquiryDetailResponse


async def update_inquiry_status_handler(
    *,
    inquiry_id: str,
    data: InquiryStatusRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> InquiryDetailResponse:
    service = UpdateInquiryStatusService(uow.repo(InquiryRepository))
    atomic, inquiry = await service.execute(
        inquiry_id,
        status=data.status,
    )

    await emit(
        uow,
        "inquiry_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    response = InquiryDetailResponse.model_validate(inquiry)
    if inquiry.answered_by:
        names = await uow.repo(AdminAccountRepository).aggregate_name_map_by_ids(ids=[inquiry.answered_by])
        response.answered_by_name = names.get(inquiry.answered_by)
    return response


TOOL = {
    "name": "update_inquiry_status_handler",
    "permission": None,
    "purpose": "문의의 처리 상태를 변경한다.",
    "keywords": ["문의 상태 변경", "1:1 문의 처리 상태", "inquiry status"],
    "boundaries": "운영자 전용 — 문의 '상태만' 변경. 답변 작성은 answer_inquiry_handler.",
    "output": "상태가 변경된 문의 상세 (InquiryDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "inquiry_id": {'type': 'string', 'format': 'uuid', 'title': '대상 문의', 'description': '상태를 변경할 문의의 UUID.'},
            "status": {'$ref': '#/$defs/InquiryStatus', 'description': '변경할 상태: pending(대기)/in_progress(처리중)/resolved(해결)/closed(종료).'},
        },
        "$defs": {'InquiryStatus': {'enum': ['pending', 'in_progress', 'resolved', 'closed'], 'title': 'InquiryStatus', 'type': 'string'}},
        "required": ["inquiry_id", "status"],
    },
}
