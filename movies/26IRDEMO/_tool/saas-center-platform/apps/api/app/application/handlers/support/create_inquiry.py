from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.inquiry.facade import InquiryFacade
from app.modules.support.schemas import InquiryCreate, InquiryResponse


async def create_inquiry_handler(
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
    data: InquiryCreate,
    uow: UnitOfWork,
) -> InquiryResponse:
    atomic, inquiry = await InquiryFacade(uow).create_inquiry(
        inquiry_type=data.inquiry_type,
        subject=data.subject,
        content=data.content,
        sender_name=data.sender_name,
        sender_email=str(data.sender_email),
        center_id=data.center_id,
        center_name=data.center_name,
    )

    # emit — 접수팀 알림 메일은 반응(email_support_inquiry)이 워커에서 발송(재시도 가능)
    await emit(
        uow,
        "inquiry_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=inquiry.center_id,
        actor_id=actor_id,
    )

    return InquiryResponse(
        success=True,
        message="문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.",
    )


TOOL = {
    "name": 'create_inquiry_handler',
    "agent_exposed": False,  # emit 핸들러 — event_group_id 필요, agent mutation 경로가 미주입(create_notice와 동일)
    "permission": None,
    "purpose": '고객센터에 1:1 문의를 접수하고 담당자에게 알림 메일이 가도록 한다.',
    "keywords": ['create inquiry', '문의하기', '1:1 문의', '문의 접수', '고객센터 문의', '질문 보내기', '문의 등록', 'support 문의', '도움 요청'],
    "boundaries": "새 문의를 '접수'하는 도구다. 내가 보낸 문의 내역 조회는 list_my_inquiries_handler, 공개 FAQ 검색은 list_public_faqs_handler를 쓴다. 접수 후 운영팀에 문의 메일이 백그라운드로 발송된다.",
    "output": '문의 접수 결과 (InquiryResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'inquiry_type': {'default': 'general', 'title': '문의 유형', 'type': 'string', 'enum': ['general', 'technical', 'feature_request', 'other'], 'description': '문의 유형: general(일반)/technical(기술)/feature_request(기능 요청)/other(기타).'},
            'subject': {'title': '제목', 'type': 'string', 'description': '문의 제목.'},
            'content': {'title': '내용', 'type': 'string', 'description': '문의 본문.'},
            'sender_name': {'title': '보낸 사람', 'type': 'string', 'description': '문의자 이름.'},
            'sender_email': {'format': 'email', 'title': '보낸 이메일', 'type': 'string', 'description': '회신받을 이메일.'},
            'center_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '관련 센터', 'description': '관련 센터 UUID(선택).'},
            'center_name': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '센터명', 'description': '관련 센터명(표시용, 선택).'},
        },
        "required": ['subject', 'content', 'sender_name', 'sender_email'],
    },
}
