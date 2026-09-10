from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import DocumentResponse
from ..repository import DocumentRepository
from ..services import GetDocumentService


async def get_document_handler(
    document_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> DocumentResponse:
    document_repo = uow.repo(DocumentRepository)

    get_service = GetDocumentService(document_repo)
    document = await get_service.execute(document_id, center_id)

    return DocumentResponse.model_validate(document)


TOOL = {
    "name": "get_document_handler",
    "permission": "read:document",
    "purpose": "문서 한 건의 메타정보를 조회한다.",
    "keywords": ["문서 조회", "자료 상세", "document 조회"],
    "boundaries": "문서 메타 조회(읽기). 파일은 download_document_handler, 목록은 list_documents_handler.",
    "output": "문서 메타정보 (DocumentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 문서",
                "description": "조회할 문서의 UUID.",
            },
        },
        "required": ["document_id"],
    },
}
