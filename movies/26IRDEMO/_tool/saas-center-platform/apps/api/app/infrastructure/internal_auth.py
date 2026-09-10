from fastapi import HTTPException, Request, status

from app.core.config import settings


async def verify_internal_secret(request: Request) -> None:
    # machine(내부/cron) 게이트 — 공유 시크릿. 미설정 = 배포 구성 오류로 명시 실패(무인증 개방 방지)
    if not settings.INTERNAL_API_SECRET:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "INTERNAL_API_SECRET not configured"
        )
    if request.headers.get("X-Internal-Secret", "") != settings.INTERNAL_API_SECRET:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid internal secret")
