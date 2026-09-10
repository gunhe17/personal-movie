from urllib.parse import quote
from fastapi import Request
from fastapi.responses import StreamingResponse
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import StorageClient
from app.modules.event import emit


async def download_with_share_token_handler(
    token: str,
    password: str | None,
    request: Request | None,
    storage: StorageClient,
    uow: UnitOfWork,
    *,
    event_group_id: str,
) -> StreamingResponse:
    # Facade: 토큰 검증 + 문서 조회 + 다운로드 횟수 + 접근 로그 (레시피 캡슐화)
    from ...facade import DocumentFacade

    facade = DocumentFacade(uow)
    atomic, document = await facade.download_with_token_and_log(
        token=token,
        password=password,
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    await emit(
        uow,
        "share_token_downloaded",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=document.center_id,
        actor_type="external",
    )

    # S3에서 파일 다운로드 (도메인 예외는 StorageClient에서 발생)
    file_data = await storage.download_file(
        path=document.storage_path,
        version_id=None,  # 공유는 항상 최신 버전
    )

    # 파일 스트림 응답 (한글 파일명 처리)
    # RFC 5987/6266: filename*=UTF-8''encoded_filename
    download_filename = document.original_name or document.name
    encoded_filename = quote(download_filename, safe="")

    # ASCII fallback for filename parameter (한글 제거)
    ascii_filename = download_filename.encode("ascii", "ignore").decode("ascii")
    if not ascii_filename.strip():
        ascii_filename = "download"  # 한글만 있는 경우 기본값

    return StreamingResponse(
        iter([file_data]),
        media_type=document.file_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded_filename}",
            "Content-Length": str(document.file_size),
        },
    )


TOOL = {
    "name": "download_with_share_token_handler",
    "permission": None,
    "purpose": "공유 토큰으로 문서 파일을 내려받는다.",
    "keywords": ["공유 링크 다운로드", "토큰 다운로드", "공유 문서 받기"],
    "boundaries": "공유 토큰으로 파일 스트리밍 다운로드(외부 공유용). 일반 다운로드는 document/download_document_handler.",
    "output": "공유 문서 파일 스트림 (StreamingResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "token": {
                "type": "string",
                "title": "공유 토큰",
                "description": "공유 토큰 문자열.",
            },
            "password": {
                "type": "string",
                "title": "공유 비밀번호",
                "description": "공유 비밀번호(설정 시).",
            },
        },
        "required": ["token"],
    },
}
