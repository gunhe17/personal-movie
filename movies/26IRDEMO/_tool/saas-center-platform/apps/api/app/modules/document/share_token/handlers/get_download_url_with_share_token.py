from fastapi import Request
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import StorageClient
from app.modules.event import emit
from ..schemas import ShareTokenDownloadUrlResponse


async def get_download_url_with_share_token_handler(
    token: str,
    password: str | None,
    expires_in: int,
    request: Request | None,
    storage: StorageClient,
    uow: UnitOfWork,
    *,
    event_group_id: str,
) -> ShareTokenDownloadUrlResponse:
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

    download_url = await storage.get_presigned_url(
        path=document.storage_path,
        version_id=None,
        expires_in=expires_in,
    )

    return ShareTokenDownloadUrlResponse(
        download_url=download_url,
        expires_in=expires_in,
        document_id=document.id,
        document_name=document.name,
    )


TOOL = {
    "name": "get_download_url_with_share_token_handler",
    "permission": None,
    "purpose": "공유 토큰으로 문서의 임시 다운로드 URL(pre-signed)을 발급한다.",
    "keywords": [
        "공유 링크 URL",
        "토큰 다운로드 링크",
        "공유 pre-signed url",
        "외부 다운로드 링크",
    ],
    "boundaries": "공유 토큰으로 외부 사용자가 직접 받도록 pre-signed URL을 발급한다. 스트리밍 다운로드는 download_with_share_token_handler.",
    "output": "공유 문서 임시 다운로드 URL (ShareTokenDownloadUrlResponse).",
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
            "expires_in": {
                "type": "integer",
                "title": "만료 시간(초)",
                "description": "URL 만료 시간(초).",
            },
        },
        "required": ["token", "expires_in"],
    },
}
