from app.core.datetime_utils import utc_now

from app.modules.platform_admin.qna.schemas import InquiryAnswerRequest, InquiryDetailResponse, InquiryStatus
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.admin_account.facade import AdminAccountFacade
from app.modules.platform_admin.inquiry.facade import InquiryFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic

logger = get_logger(__name__)


async def _find_member_id_by_email(
    uow: UnitOfWork,
    center_id: str,
    email: str,
) -> str | None:
    from app.modules.auth.client import AccountClient
    from app.modules.center.client import MemberClient
    from app.modules.person.client import PersonClient

    account = await AccountClient(uow).find_by_email(email)
    if not account:
        return None

    person = await PersonClient(uow).find_by_account_id(account.id)
    if not person:
        return None

    member = await MemberClient(uow).find_by_person(center_id, person.id)
    return member.id if member else None


async def answer_inquiry_handler(
    *,
    inquiry_id: str,
    data: InquiryAnswerRequest,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> InquiryDetailResponse:
    inquiry = await InquiryFacade(uow).answer_inquiry(
        inquiry_id,
        answer=data.answer,
        answered_by=actor_id,
        answered_at=utc_now(),
        status=InquiryStatus.RESOLVED,
    )

    await emit(
        uow,
        "inquiry_answered",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="answered",
            _entity_name="inquiry",
            _entity_id=inquiry_id,
            _payload={"data": {"id": inquiry_id, "subject": inquiry.subject}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    response = InquiryDetailResponse.model_validate(inquiry)
    names = await AdminAccountFacade(uow).aggregate_admin_names([actor_id])
    response.answered_by_name = names.get(actor_id)
    return response


TOOL = {
    "name": "answer_inquiry_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "문의(inquiry)에 답변을 작성한다.",
    "keywords": ["문의 답변", "1:1 문의 응답", "inquiry answer"],
    "boundaries": "운영자 전용 — 문의에 '답변' 작성(상태도 갱신). 상태만 변경은 update_inquiry_status_handler.",
    "output": "답변이 반영된 문의 상세 (InquiryDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "inquiry_id": {'type': 'string', 'format': 'uuid', 'title': '대상 문의', 'description': '답변할 문의의 UUID.'},
            "answer": {'type': 'string', 'minLength': 1, 'title': '답변 내용', 'description': '문의에 대한 답변 본문.'},
        },
        "required": ["inquiry_id", "answer"],
    },
}
