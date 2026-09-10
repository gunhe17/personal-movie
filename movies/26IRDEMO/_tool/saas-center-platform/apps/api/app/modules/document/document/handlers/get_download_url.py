from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import StorageClient
from ..schemas import DownloadUrlResponse
from ...facade import DocumentFacade


async def get_download_url_handler(
    document_id: str,
    version_id: str | None,
    expires_in: int,
    center_id: str,
    account_id: str,
    ip_address: str | None,
    user_agent: str | None,
    storage: StorageClient,
    uow: UnitOfWork,
) -> DownloadUrlResponse:
    facade = DocumentFacade(uow)
    document = await facade.download_document_with_log(
        document_id=document_id,
        center_id=center_id,
        account_id=account_id,
        version_id=version_id,
        action="download",
        ip_address=ip_address,
        user_agent=user_agent,
    )


    download_url = await storage.get_presigned_url(
        path=document.storage_path,
        version_id=version_id,
        expires_in=expires_in,
    )

    return DownloadUrlResponse(
        download_url=download_url,
        expires_in=expires_in,
        document_id=document.id,
        document_name=document.name,
    )


TOOL = {
    "name": "get_download_url_handler",
    "permission": "read:document",
    "purpose": "문서의 임시 다운로드 URL(pre-signed)을 발급한다.",
    "keywords": ["다운로드 URL", "문서 링크", "pre-signed url", "직접 다운로드 링크"],
    "boundaries": "클라이언트가 직접 받도록 문서 pre-signed URL을 발급한다. 서버 스트리밍 다운로드는 download_document_handler.",
    "output": "문서 임시 다운로드 URL (DownloadUrlResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_id": {"type": "string", "format": "uuid", "title": "대상 문서", "description": "URL을 발급할 문서의 UUID."},
            "version_id": {"type": "string", "format": "uuid", "title": "버전", "description": "특정 버전(선택, 없으면 최신)."},
            "expires_in": {"type": "integer", "title": "만료 시간(초)", "description": "URL 만료 시간(초)."},
        },
        "required": ["document_id", "expires_in"],
    },
}
