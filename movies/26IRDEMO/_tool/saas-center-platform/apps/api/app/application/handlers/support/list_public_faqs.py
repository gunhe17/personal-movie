
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.faq.facade import FAQFacade
from app.modules.platform_admin.qna.schemas import FAQDetailResponse
from app.modules.support.schemas import PublicFAQListResponse


async def list_public_faqs_handler(
    *,
    category: str | None = None,
    search: str | None = None,
    page: int = 1,
    size: int = 100,
    uow: UnitOfWork,
) -> PublicFAQListResponse:
    rows, page_meta = await FAQFacade(uow).list_published_with_page(
        category=category, search=search, page=page, size=size
    )
    return PublicFAQListResponse(
        items=[FAQDetailResponse.model_validate(r) for r in rows],
        **page_meta,
    )


TOOL = {
    "name": 'list_public_faqs_handler',
    "permission": None,
    "purpose": '공개된 자주 묻는 질문(FAQ)을 카테고리·검색어로 거르고 페이지 단위로 조회한다.',
    "keywords": ['list public faqs', 'FAQ', '자주 묻는 질문', '도움말', 'FAQ 목록', '질문 검색', '고객센터 FAQ', '안내 글', '도움말 검색'],
    "boundaries": "누구나 볼 수 있는 '게시된' FAQ만 조회하는 읽기 전용 도구다(로그인 불필요). 내가 보낸 1:1 문의 내역은 list_my_inquiries_handler, 새 문의 접수는 create_inquiry_handler를 쓴다.",
    "output": '공개 FAQ 목록 (PublicFAQListResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'category': {'type': 'string', 'title': '분류 필터', 'description': 'FAQ 카테고리 필터. 비우면 전체 카테고리.'},
            'search': {'type': 'string', 'title': '검색어', 'description': '질문·답변 본문 검색어. 비우면 검색 없이 전체.'},
            'page': {'type': 'integer', 'title': '페이지', 'description': '가져올 페이지 번호. 1부터 시작.'},
            'size': {'type': 'integer', 'title': '페이지 크기', 'description': '한 페이지에 담을 FAQ 수 (1~200, 기본 100).'},
        },
        "required": [],
    },
}
