import uuid

from fastapi import UploadFile

from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.common.base import StorageClient
from app.modules.event import emit

from ..repository import PersonCredentialRepository
from ..schemas import CredentialResponse
from ..services import GetCredentialService, UploadAttachmentService
from app.core.logger import get_logger

logger = get_logger(__name__)

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def _detect_real_content_type(data: bytes) -> str | None:
    # Content-Type 헤더는 위조 가능 → 바이너리 첫 바이트(매직넘버)로 실제 타입 확인. 모르면 None.
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    return None


async def upload_credential_attachment_handler(
    credential_id: str,
    person_id: str,
    file: UploadFile,
    storage: StorageClient,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> CredentialResponse:
    # 교체 시 기존 첨부 정리 + 업로드 후 verification 자동 리셋.
    # 1. 파일 검증
    declared_type = (file.content_type or "").lower()
    if declared_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidOperationException(
            "지원하지 않는 파일 형식입니다. (PDF, JPG, PNG만 허용)"
        )

    file_data = await file.read()
    if not file_data:
        raise InvalidOperationException("빈 파일은 업로드할 수 없습니다.")

    if len(file_data) > MAX_FILE_SIZE:
        raise InvalidOperationException("파일 크기는 10MB 이하여야 합니다.")

    # 매직 넘버로 실제 타입 재확인 (Content-Type 헤더 위조 방어)
    real_type = _detect_real_content_type(file_data)
    if real_type is None or real_type != declared_type:
        raise InvalidOperationException(
            "지원하지 않는 파일 형식입니다. (PDF, JPG, PNG만 허용)"
        )
    content_type = real_type

    # 2. 소유자 확인 (Service로 위임)
    repo = uow.repo(PersonCredentialRepository)
    existing = await GetCredentialService(repo).execute(
        credential_id, person_id=person_id
    )

    # 3. S3 업로드 — 파일명 충돌 방지로 uuid prefix
    filename = file.filename or "attachment"
    safe_name = f"{uuid.uuid4().hex}_{filename}"
    s3_path = f"credentials/{person_id}/{credential_id}/{safe_name}"

    upload_result = await storage.upload_file(
        file_data=file_data,
        path=s3_path,
        content_type=content_type,
    )

    # 4. DB 갱신 (Service가 verification도 함께 리셋)
    try:
        repo = uow.repo(PersonCredentialRepository)
        service = UploadAttachmentService(repo)
        atomic, updated = await service.execute(
            credential_id=credential_id,
            person_id=person_id,
            url=s3_path,
            filename=filename,
            content_type=content_type,
            size=upload_result.get("size") or len(file_data),
        )
        await emit(
            uow,
            "person_credential_attachment_uploaded",
            event_group_id=event_group_id,
            atomics=[atomic],
            actor_id=actor_id,
        )
    except Exception:
        # DB 반영 실패 시 방금 올린 S3 객체를 정리(orphan 방지) — 정리 실패는 무시하고 원예외 전파
        try:
            await storage.delete_file(s3_path)
        except Exception:
            logger.warning(
                "credential 첨부 파일 삭제 실패 — 고아 파일 잔존 가능", exc_info=True
            )
        raise

    # 5. 기존 첨부가 있었다면 S3에서 정리 (Best-effort, 실패해도 트랜잭션 영향 없음)
    if existing.attachment_url and existing.attachment_url != s3_path:
        try:
            await storage.delete_file(existing.attachment_url)
        except Exception:
            logger.warning(
                "credential 기존 첨부 정리 실패 — 고아 파일 잔존 가능", exc_info=True
            )

    return CredentialResponse.from_orm_model(updated)


TOOL = {
    "name": "upload_credential_attachment_handler",
    "permission": None,
    "purpose": "자격 증빙 첨부파일을 업로드한다.",
    "keywords": ["자격 첨부 업로드", "증빙 올리기", "attachment 업로드"],
    "boundaries": "자격 증빙 파일 업로드. 다운로드는 download_attachment_handler.",
    "output": "첨부 업로드 후 자격 (CredentialResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "credential_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 자격",
                "description": "첨부를 올릴 자격의 UUID.",
            },
            "file": {
                "type": "string",
                "title": "증빙 파일",
                "description": "업로드할 증빙 파일.",
            },
        },
        "required": ["credential_id", "file"],
    },
}
