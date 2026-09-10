from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import DocumentAccessSummary, DocumentAccessListResponse
from ..repository import DocumentAccessRepository
from ..services import ListAccountAccessesService


async def list_account_accesses_handler(
    account_id: str,
    center_id: str,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> DocumentAccessListResponse:
    # Repository 획득
    access_repo = uow.repo(DocumentAccessRepository)

    # Service 실행 (센터 ID로 필터링)
    list_service = ListAccountAccessesService(access_repo)
    access_logs, page_meta = await list_service.execute(
        account_id=account_id, center_id=center_id, page=page, size=size
    )

    return DocumentAccessListResponse(
        items=[DocumentAccessSummary.model_validate(log) for log in access_logs],
        **page_meta,
    )


TOOL = {
    "name": "list_account_accesses_handler",
    "permission": None,
    "purpose": "특정 계정의 문서 접근 이력을 조회한다.",
    "keywords": ["계정 접근 이력", "문서 열람 기록", "account access"],
    "boundaries": "한 계정의 문서 접근 이력(읽기). 문서 기준은 list_document_accesses_handler.",
    "output": "계정별 문서 접근 이력 (DocumentAccessListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
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
        "required": ["page", "size"],
    },
}
