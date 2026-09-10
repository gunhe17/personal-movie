# 서버가 첨부를 받아 스트리밍 — 프론트가 S3에 직접 접근 안 해 CORS 이슈 없음.
from urllib.parse import quote

from fastapi.responses import StreamingResponse

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.common.base import StorageClient

from ..repository import PersonCredentialRepository
from ..services import GetCredentialService


async def download_attachment_handler(
    credential_id: str,
    person_id: str,
    storage: StorageClient,
    uow: UnitOfWork,
) -> StreamingResponse:
    repo = uow.repo(PersonCredentialRepository)
    credential = await GetCredentialService(repo).execute(
        credential_id, person_id=person_id
    )

    if not credential.attachment_url:
        raise EntityNotFoundException("첨부 파일이 없습니다.")

    file_data = await storage.download_file(path=credential.attachment_url)

    filename = credential.attachment_filename or "attachment"
    encoded_filename = quote(filename, safe="")
    ascii_filename = (
        filename.encode("ascii", "ignore").decode("ascii").strip() or "attachment"
    )

    return StreamingResponse(
        iter([file_data]),
        media_type=credential.attachment_content_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_filename}"; '
                f"filename*=UTF-8''{encoded_filename}"
            ),
        },
    )


TOOL = {
    "name": "download_attachment_handler",
    "permission": None,
    "purpose": "자격 증빙 첨부파일을 내려받는다.",
    "keywords": ["자격 첨부 다운로드", "증빙 다운로드", "attachment 받기"],
    "boundaries": "자격 첨부파일 스트리밍 다운로드. 업로드는 upload_credential_attachment_handler.",
    "output": "자격 증빙 첨부 파일 스트림 (StreamingResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "credential_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 자격",
                "description": "첨부를 내려받을 자격의 UUID.",
            },
        },
        "required": ["credential_id"],
    },
}
