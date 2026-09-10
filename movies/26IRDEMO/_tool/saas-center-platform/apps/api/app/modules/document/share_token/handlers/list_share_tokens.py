from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import ShareTokenSummary, ShareTokenListResponse
from ..repository import ShareTokenRepository
from ..services import ListShareTokensService
from ...document.repository import DocumentRepository
from ...document.services import GetDocumentService


async def list_share_tokens_handler(
    document_id: str,
    center_id: str,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> ShareTokenListResponse:
    # Repository 획득
    document_repo = uow.repo(DocumentRepository)
    share_token_repo = uow.repo(ShareTokenRepository)

    # Service: 문서 조회 + 권한 검증
    get_document_service = GetDocumentService(document_repo)
    document = await get_document_service.execute(
        document_id=document_id, center_id=center_id
    )

    # Service 실행
    list_service = ListShareTokensService(share_token_repo)
    tokens, page_meta = await list_service.execute(
        document_id=document.id, page=page, size=size
    )

    return ShareTokenListResponse(
        items=[ShareTokenSummary.model_validate(token) for token in tokens],
        **page_meta,
    )


TOOL = {
    "name": "list_share_tokens_handler",
    "permission": None,
    "purpose": "문서의 공유 토큰 목록을 조회한다.",
    "keywords": ["공유 링크 목록", "공유 토큰 조회", "share token 목록"],
    "boundaries": "한 문서의 공유 토큰 목록(읽기). 생성은 create_share_token_handler.",
    "output": "문서 공유 토큰 목록 (ShareTokenListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 문서",
                "description": "공유 토큰을 조회할 문서의 UUID.",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": ["document_id", "page", "size"],
    },
}
