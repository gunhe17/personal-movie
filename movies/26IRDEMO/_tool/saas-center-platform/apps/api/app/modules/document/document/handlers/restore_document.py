from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import DocumentResponse
from ...facade import DocumentFacade


async def restore_document_handler(
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
    atomic, document = await facade.restore_document_with_log(
        document_id=document_id,
        center_id=center_id,
        account_id=account_id,
        action="restore",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await emit(
        uow,
        "document_restored",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return DocumentResponse.model_validate(document)


TOOL = {
    "name": "restore_document_handler",
    "permission": "delete:document",
    "purpose": "삭제된 문서를 복구한다.",
    "keywords": ['restore document', "문서 복구", "삭제 취소", "document restore", "자료 복원"],
    "boundaries": "삭제된 문서를 되살린다. 삭제는 delete_document_handler.",
    "output": "복구된 문서 (DocumentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_id": {"type": "string", "format": "uuid", "title": "대상 문서", "description": "복구할 문서의 UUID."},
        },
        "required": ["document_id"],
    },
}
