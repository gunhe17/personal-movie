from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.document.facade.document_facade import DocumentFacade
from app.modules.document.document.schemas import DocumentSummary
from app.modules.client.facade.resource_facade import ResourceFacade
from app.application.schemas import ClientDocumentItem


async def link_client_document_handler(
    center_id: str,
    client_id: str,
    document_id: str,
    resource_type: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> ClientDocumentItem:
    doc_facade = DocumentFacade(uow)
    document = await doc_facade.get_document(document_id, center_id)

    resource_facade = ResourceFacade(uow)
    mapping_atomic, mapping = await resource_facade.link_document(
        center_id=center_id,
        client_id=client_id,
        document_id=document.id,
        resource_type=resource_type,
    )

    await emit(
        uow,
        "client_resource_linked",
        event_group_id=event_group_id,
        atomics=[mapping_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ClientDocumentItem(
        mapping_id=mapping.id,
        document=DocumentSummary.model_validate(document),
        resource_type=mapping.resource_type,
        created_at=mapping.created_at,
    )


TOOL = {
    "name": "link_client_document_handler",
    "permission": "write:document",
    "purpose": "이미 업로드된 문서를 내담자에 연결한다.",
    "keywords": ['link client document', "문서 연결", "내담자 문서 첨부", "자료 연결", "문서 링크", "document 연결"],
    "boundaries": "기존 문서를 내담자에 '연결'한다(신규 업로드 아님). 내담자 문서 목록은 list_client_documents_handler.",
    "output": "연결된 문서 (ClientDocumentItem).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {"type": "string", "format": "uuid", "title": "대상 내담자",
                          "description": "문서를 연결할 내담자의 UUID."},
            "document_id": {"type": "string", "format": "uuid", "title": "대상 문서",
                            "description": "연결할 문서의 UUID."},
            "resource_type": {"type": "string", "title": "자원 유형",
                              "description": "문서의 자원 유형(분류)."},
        },
        "required": ["client_id", "document_id", "resource_type"],
    },
}
