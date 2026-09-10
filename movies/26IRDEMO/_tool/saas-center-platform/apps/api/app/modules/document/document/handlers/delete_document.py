from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import DocumentResponse
from ...facade import DocumentFacade


async def delete_document_handler(
    *,
    event_group_id: uuid_str,
    document_id: str,
    center_id: str,
    account_id: str,
    ip_address: str | None,
    user_agent: str | None,
    uow: UnitOfWork,
    actor_id: str,
) -> DocumentResponse:
    facade = DocumentFacade(uow)
    atomic, document = await facade.delete_document_with_log(
        document_id=document_id,
        center_id=center_id,
        account_id=account_id,
        action="delete",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await emit(
        uow,
        "document_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return DocumentResponse.model_validate(document)


TOOL = {
    "name": "delete_document_handler",
    "permission": "delete:document",
    "purpose": "문서를 삭제한다.",
    "keywords": ['delete document', "문서 삭제", "자료 삭제", "document 삭제"],
    "boundaries": "문서 삭제. 조회는 get_document_handler.",
    "output": "삭제된 문서 (DocumentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_id": {"type": "string", "format": "uuid", "title": "대상 문서", "description": "삭제할 문서의 UUID."},
        },
        "required": ["document_id"],
    },
}
