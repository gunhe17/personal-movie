from fastapi import UploadFile
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import StorageClient
from app.modules.event import emit
from ..schemas import DocumentResponse
from ...facade import DocumentFacade


async def upload_document_handler(
    center_id: str,
    uploader_id: str,
    account_id: str,
    file: UploadFile,
    name: str | None,
    ip_address: str | None,
    user_agent: str | None,
    storage: StorageClient,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
) -> DocumentResponse:
    facade = DocumentFacade(uow, storage)
    atomics, document = await facade.upload_new_document(
        center_id=center_id,
        uploader_id=uploader_id,
        account_id=account_id,
        file=file,
        name=name,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    await emit(
        uow,
        "document_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=uploader_id,
    )

    await uow.session.refresh(document)
    return DocumentResponse.model_validate(document)


TOOL = {
    "name": "upload_document_handler",
    "permission": "write:document",
    "agent_exposed": False,  # UploadFile 바이너리 — agent 입력 부적합
    "purpose": "파일을 업로드해 문서로 등록한다.",
    "keywords": ["문서 업로드", "파일 올리기", "자료 등록", "document upload"],
    "boundaries": "파일을 올려 문서 '생성'. 메타 수정은 update_document_handler.",
    "output": "업로드되어 등록된 문서 (DocumentResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "title": "업로드 파일",
                "description": "업로드할 파일.",
            },
            "name": {
                "type": "string",
                "title": "문서 이름",
                "description": "문서 이름(선택, 없으면 파일명).",
            },
        },
        "required": ["file"],
    },
}
