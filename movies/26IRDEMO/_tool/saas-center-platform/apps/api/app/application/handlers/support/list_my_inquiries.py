
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.facade import AccountFacade
from app.modules.platform_admin.inquiry.facade import InquiryFacade
from app.modules.platform_admin.qna.schemas import InquiryDetailResponse
from app.modules.support.schemas import InquiryListResponse


async def list_my_inquiries_handler(
    *,
    account_id: str,
    center_id: str | None = None,
    page: int = 1,
    size: int = 20,
    uow: UnitOfWork,
) -> InquiryListResponse:
    # scope엔 email 안 담음 → account_id로 owning(account) 모듈서 해소 (behavior.md §2)
    accounts = await AccountFacade(uow).get_accounts_by_ids([account_id])
    account = accounts.get(account_id)
    if not account or not account.email:
        return InquiryListResponse(items=[], total=0, page=page, size=size, pages=0)

    rows, page_meta = await InquiryFacade(uow).list_by_sender_email_with_page(
        sender_email=account.email, center_id=center_id, page=page, size=size
    )
    return InquiryListResponse(
        items=[InquiryDetailResponse.model_validate(r) for r in rows],
        **page_meta,
    )


TOOL = {
    "name": 'list_my_inquiries_handler',
    "permission": None,
    "purpose": '현재 로그인한 사용자가 보낸 1:1 고객센터 문의 내역을 페이지 단위로 조회한다.',
    "keywords": ['list my inquiries', '내 문의', '문의 내역', '1:1 문의', '내가 보낸 문의', '문의 목록', '고객센터 문의 내역', '질문 내역', '답변 확인'],
    "boundaries": "로그인한 '본인'이 보낸 문의만 이메일 기준으로 조회한다(읽기 전용). 공개 FAQ는 list_public_faqs_handler, 새 문의 접수는 create_inquiry_handler를 쓴다. 남의 문의는 볼 수 없다.",
    "output": '내가 보낸 문의 내역 목록 (InquiryListResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'center_id': {'type': 'string', 'format': 'uuid', 'title': '센터 필터', 'description': '특정 센터로 보낸 문의만 거를 센터 ID. 비우면 전체.'},
            'page': {'type': 'integer', 'title': '페이지', 'description': '가져올 페이지 번호. 1부터 시작.'},
            'size': {'type': 'integer', 'title': '페이지 크기', 'description': '한 페이지에 담을 문의 수 (1~100, 기본 20).'},
        },
        "required": [],
    },
}
