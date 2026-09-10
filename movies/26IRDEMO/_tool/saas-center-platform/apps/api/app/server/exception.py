from __future__ import annotations

import traceback
import uuid

from fastapi import Request, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logger import get_logger
from app.core.exceptions import (
    ConflictException,
    DomainException,
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
    QuotaExceededException,
    RateLimitException,
    UnauthorizedException,
)
from app.server.server import ExceptionHandler

logger = get_logger(__name__)


_DOMAIN_STATUS: list[tuple[type[Exception], int]] = [
    (EntityNotFoundException, status.HTTP_404_NOT_FOUND),
    (PermissionDeniedException, status.HTTP_403_FORBIDDEN),
    (InvalidOperationException, status.HTTP_400_BAD_REQUEST),
    (ConflictException, status.HTTP_409_CONFLICT),
    (UnauthorizedException, status.HTTP_401_UNAUTHORIZED),
    (RateLimitException, status.HTTP_429_TOO_MANY_REQUESTS),
    (QuotaExceededException, status.HTTP_429_TOO_MANY_REQUESTS),
    # 안전망: 위 7종에 안 걸린 DomainException 파생은 500(fallback) 대신 400.
    # 구체 매핑을 위해 신규 도메인 예외는 위 7종 중 하나를 상속할 것(MRO 특이성으로 7종이 우선).
    (DomainException, status.HTTP_400_BAD_REQUEST),
]


# #
# factory

def domain_handlers() -> list[ExceptionHandler]:
    """도메인 예외 7종 → `{"detail": exc.message}` + 해당 status."""

    def _make(code: int):
        async def handler(request: Request, exc: Exception) -> JSONResponse:
            return JSONResponse(
                status_code=code,
                content={"detail": getattr(exc, "message", str(exc))},
            )
        return handler

    return [
        ExceptionHandler(exception_class=exc_class, handler=_make(code))
        for exc_class, code in _DOMAIN_STATUS
    ]


def fallback() -> ExceptionHandler:
    """전역 예외 — 서버엔 전체 스택, 클라이언트엔 dev 상세/prod 간단."""

    async def handler(request: Request, exc: Exception) -> JSONResponse:
        # trace_id: 미들웨어 생성 ID 재사용 → 요청/에러 로그 연결
        trace_id = getattr(request.state, "trace_id", str(uuid.uuid4())[:8])
        error_id = str(uuid.uuid4())

        logger.error(
            f"Unhandled exception [trace_id: {trace_id}] [error_id: {error_id}] "
            f"{request.method} {request.url.path} - {type(exc).__name__}: {str(exc)}",
            extra={
                "trace_id": trace_id,
                "error_id": error_id,
                "method": request.method,
                "path": request.url.path,
            },
            exc_info=exc,
        )

        if settings.DEBUG:
            return JSONResponse(
                status_code=500,
                content={
                    "trace_id": trace_id,
                    "error_id": error_id,
                    "detail": str(exc),
                    "type": type(exc).__name__,
                    "traceback": traceback.format_exc().split("\n"),
                },
            )
        return JSONResponse(
            status_code=500,
            content={
                "detail": "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
            },
        )

    return ExceptionHandler(exception_class=Exception, handler=handler)
