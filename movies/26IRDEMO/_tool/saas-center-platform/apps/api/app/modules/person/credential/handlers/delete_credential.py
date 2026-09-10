from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.common.base import StorageClient
from app.modules.event import emit

from ..repository import PersonCredentialRepository
from ..services import DeleteCredentialService
from app.core.logger import get_logger

logger = get_logger(__name__)

async def delete_credential_handler(
    credential_id: str,
    person_id: str,
    storage: StorageClient,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> None:
    atomic, deleted = await DeleteCredentialService(uow.repo(PersonCredentialRepository)).execute(
        credential_id, person_id
    )
    await emit(
        uow,
        "person_credential_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )

    # 첨부 S3 객체 정리 (Best-effort, 실패해도 요청 영향 없음)
    if deleted.attachment_url:
        try:
            await storage.delete_file(deleted.attachment_url)
        except Exception:
            logger.warning("credential 첨부 파일 삭제 실패 — 고아 파일 잔존 가능", exc_info=True)


TOOL = {
    "name": "delete_credential_handler",
    "permission": None,
    "purpose": "개인 자격을 삭제한다.",
    "keywords": ["자격 삭제", "자격증 제거", "credential 삭제"],
    "boundaries": "개인 자격 삭제. 조회는 list_credentials_handler.",
    "output": "없음 (자격 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "credential_id": {"type": "string", "format": "uuid", "title": "대상 자격", "description": "삭제할 자격의 UUID."},
        },
        "required": ["credential_id"],
    },
}
