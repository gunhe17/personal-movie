"""Credential 응답에 첨부 파일 presigned URL을 주입한다.

DB에는 S3 path만 저장하므로(`attachment_url` 컬럼은 사실 path),
프론트에서 바로 열람/다운로드할 수 있도록 응답 직전 presigned URL로 교체.
storage는 factory로 취득(infrastructure.md) — 호출자가 주입하지 않는다.
"""
from app.infrastructure.storage import get_storage_client

from .schemas import CredentialResponse

# presigned URL 만료 (초). 어드민/본인 조회 시점에 발급하므로 1시간이면 충분.
DEFAULT_EXPIRES_IN = 3600


async def attach_presigned_url(
    credential: CredentialResponse,
    expires_in: int = DEFAULT_EXPIRES_IN,
) -> CredentialResponse:
    """단일 credential의 attachment.url을 presigned URL로 교체."""
    if credential.attachment and credential.attachment.url:
        try:
            credential.attachment.url = await get_storage_client().get_presigned_url(
                credential.attachment.url, expires_in=expires_in
            )
        except Exception:
            # presigned 발급 실패 시 raw S3 key(내부 경로·person_id 포함)를 응답에 노출하지 않는다.
            credential.attachment.url = ""
    return credential


async def attach_presigned_urls(
    credentials: list[CredentialResponse],
    expires_in: int = DEFAULT_EXPIRES_IN,
) -> list[CredentialResponse]:
    """목록 응답 일괄 처리."""
    for c in credentials:
        await attach_presigned_url(c, expires_in=expires_in)
    return credentials
