from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.common.base import StorageClient
from app.modules.event import emit

from ..repository import PersonCredentialRepository
from ..schemas import CredentialResponse
from ..services import DeleteAttachmentService, GetCredentialService
from app.core.logger import get_logger

logger = get_logger(__name__)

async def delete_attachment_handler(
    credential_id: str,
    person_id: str,
    storage: StorageClient,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> CredentialResponse:
    # 1. 기존 첨부 경로 확보
    repo = uow.repo(PersonCredentialRepository)
    existing = await GetCredentialService(repo).execute(
        credential_id, person_id=person_id
    )

    if not existing.attachment_url:
        # 이미 첨부 없음 → 그대로 반환 (멱등성)
        return CredentialResponse.from_orm_model(existing)

    s3_path = existing.attachment_url

    # 2. DB 메타 초기화 + verification 리셋
    repo = uow.repo(PersonCredentialRepository)
    service = DeleteAttachmentService(repo)
    atomic, updated = await service.execute(
        credential_id=credential_id,
        person_id=person_id,
    )
    await emit(
        uow,
        "person_credential_attachment_removed",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )

    # 3. S3 삭제 (Best-effort)
    try:
        await storage.delete_file(s3_path)
    except Exception:
        logger.warning("credential 첨부 파일 삭제 실패 — 고아 파일 잔존 가능", exc_info=True)

    return CredentialResponse.from_orm_model(updated)


TOOL = {
    "name": "delete_attachment_handler",
    "permission": None,
    "purpose": "자격 증빙 첨부파일을 삭제한다.",
    "keywords": ["자격 첨부 삭제", "증빙 제거", "attachment 삭제", "첨부 파일 삭제"],
    "boundaries": "자격의 증빙 첨부를 지운다. 업로드/교체는 upload_credential_attachment_handler.",
    "output": "첨부 삭제 후 자격 (CredentialResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "credential_id": {"type": "string", "format": "uuid", "title": "대상 자격", "description": "첨부를 삭제할 자격의 UUID."},
        },
        "required": ["credential_id"],
    },
}
