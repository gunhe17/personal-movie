from urllib.parse import quote
from fastapi.responses import StreamingResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import StorageClient
from ...facade import DocumentFacade


async def download_document_handler(
    document_id: str,
    version_id: str | None,
    center_id: str,
    account_id: str,
    ip_address: str | None,
    user_agent: str | None,
    storage: StorageClient,
    uow: UnitOfWork,
) -> StreamingResponse:
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


    # S3에서 파일 다운로드 (도메인 예외는 StorageClient에서 발생)
    file_data = await storage.download_file(
        path=document.storage_path,
        version_id=version_id,
    )

    # 파일 스트림 응답 (한글 파일명 처리)
    # RFC 5987/6266: filename*=UTF-8''encoded_filename
    download_filename = document.original_name or document.name
    encoded_filename = quote(download_filename, safe='')

    # ASCII fallback for filename parameter (한글 제거)
    ascii_filename = download_filename.encode('ascii', 'ignore').decode('ascii')
    if not ascii_filename.strip():
        ascii_filename = "download"  # 한글만 있는 경우 기본값

    return StreamingResponse(
        iter([file_data]),
        media_type=document.file_type,
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "Content-Length": str(document.file_size),
        },
    )


TOOL = {
    "name": "download_document_handler",
    "permission": "read:document",
    "purpose": "문서 파일을 내려받는다.",
    "keywords": ["문서 다운로드", "파일 받기", "자료 다운로드", "document download"],
    "boundaries": "문서 파일을 스트리밍 다운로드. 공유 토큰 다운로드는 share_token/download_with_share_token_handler.",
    "output": "문서 파일 스트림 (StreamingResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_id": {"type": "string", "format": "uuid", "title": "대상 문서", "description": "내려받을 문서의 UUID."},
            "version_id": {"type": "string", "format": "uuid", "title": "버전", "description": "특정 버전(선택, 없으면 최신)."},
        },
        "required": ["document_id"],
    },
}
