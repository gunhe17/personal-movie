"""순수 HTTP 요청 의존성 (modules 비의존)

인증/인가 관련 의존성은 `app.modules.auth.dependencies`로 분리됨.
core 레이어는 어떤 modules에도 의존하지 않음 (database.py 모델 등록 예외).
"""
from fastapi import Request
from pydantic import BaseModel, Field


class ClientInfo(BaseModel):
    """클라이언트 정보 (감사추적용)"""
    ip_address: str | None = Field(None, max_length=45)
    user_agent: str | None = None


async def get_client_info(request: Request) -> ClientInfo:
    """Request에서 클라이언트 정보 추출 (감사추적용)"""
    return ClientInfo(
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
