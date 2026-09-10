from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import DocumentAccessSummary, DocumentAccessListResponse
from ..repository import DocumentAccessRepository
from ..services import ListDocumentAccessesService
from ...document.repository import DocumentRepository
from ...document.services import GetDocumentService


async def list_document_accesses_handler(
    document_id: str,
    center_id: str,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> DocumentAccessListResponse:
    # Repository 획득
    document_repo = uow.repo(DocumentRepository)
    access_repo = uow.repo(DocumentAccessRepository)

    # Service: 문서 조회 + 권한 검증
    get_document_service = GetDocumentService(document_repo)
    document = await get_document_service.execute(
        document_id=document_id, center_id=center_id
    )

    # Service 실행
    list_service = ListDocumentAccessesService(access_repo)
    access_logs, page_meta = await list_service.execute(
        document_id=document.id, page=page, size=size
    )

    return DocumentAccessListResponse(
        items=[DocumentAccessSummary.model_validate(log) for log in access_logs],
        **page_meta,
    )


TOOL = {
    "name": "list_document_accesses_handler",
    "permission": None,
    "purpose": "특정 문서의 접근(열람) 이력을 조회한다.",
    "keywords": ["문서 접근 이력", "열람 기록", "document access"],
    "boundaries": "한 문서의 접근 이력(읽기). 계정 기준은 list_account_accesses_handler.",
    "output": "문서별 접근(열람) 이력 (DocumentAccessListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 문서",
                "description": "접근 이력을 조회할 문서의 UUID.",
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
