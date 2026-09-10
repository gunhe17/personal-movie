from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.document.facade.document_facade import DocumentFacade
from app.modules.document.document.schemas import DocumentSummary
from app.modules.client.facade.resource_facade import ResourceFacade
from app.application.schemas import (
    ClientDocumentItem,
    ClientDocumentListResponse,
)
from app.infrastructure.persistence.new_repository import single_page


async def list_client_documents_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    resource_type: str | None = None,
) -> ClientDocumentListResponse:
    resource_facade = ResourceFacade(uow)
    mappings = await resource_facade.list_documents_by_client(
        center_id=center_id,
        client_id=client_id,
        resource_type=resource_type,
    )

    if not mappings:
        return ClientDocumentListResponse(items=[], **single_page([]))

    document_ids = [m.resource_id for m in mappings]
    doc_facade = DocumentFacade(uow)
    documents = await doc_facade.get_documents_by_ids(document_ids, center_id)

    document_map = {doc.id: doc for doc in documents}

    items = []
    for mapping in mappings:
        document = document_map.get(mapping.resource_id)
        if not document:
            continue

        items.append(
            ClientDocumentItem(
                mapping_id=mapping.id,
                document=DocumentSummary.model_validate(document),
                resource_type=mapping.resource_type,
                created_at=mapping.created_at,
            )
        )

    return ClientDocumentListResponse(
        items=items,
        **single_page(items),
    )


TOOL = {
    "name": "list_client_documents_handler",
    "permission": "read:document",
    "purpose": "내담자에 연결된 문서 목록을 조회한다.",
    "keywords": [
        "list client documents",
        "내담자 문서 목록",
        "고객 자료",
        "문서 조회",
        "첨부 목록",
        "client documents",
    ],
    "boundaries": "한 내담자의 문서 목록(읽기 전용). 문서 연결은 link_client_document_handler.",
    "output": "문서 목록 (ClientDocumentListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "문서를 조회할 내담자의 UUID.",
            },
            "resource_type": {
                "type": "string",
                "title": "자원 유형 필터",
                "description": "자원 유형 필터(선택).",
            },
        },
        "required": ["client_id"],
    },
}
