from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import DocumentListResponse, DocumentSummary
from ..repository import DocumentRepository
from ..services import ListDocumentsService


async def list_documents_handler(
    center_id: str,
    owner_scope: str | None,
    page: int,
    size: int,
    include_deleted: bool,
    uow: UnitOfWork,
) -> DocumentListResponse:
    document_repo = uow.repo(DocumentRepository)

    list_service = ListDocumentsService(document_repo)
    documents, page_meta = await list_service.execute(
        center_id=center_id,
        owner_scope=owner_scope,
        page=page,
        size=size,
        include_deleted=include_deleted,
    )

    return DocumentListResponse.model_validate(
        {
            "items": [DocumentSummary.model_validate(doc) for doc in documents],
            **page_meta,
        }
    )


TOOL = {
    "name": "list_documents_handler",
    "permission": "read:document",
    "purpose": "센터 문서 목록을 페이지 단위로 조회한다.",
    "keywords": ["문서 목록", "자료 목록", "document 리스트"],
    "boundaries": "문서 목록(읽기). 단건은 get_document_handler.",
    "output": "센터 문서 목록 (DocumentListResponse).",
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
            "include_deleted": {
                "type": "boolean",
                "title": "삭제 포함",
                "description": "삭제된 문서 포함 여부.",
            },
        },
        "required": ["page", "size", "include_deleted"],
    },
}
