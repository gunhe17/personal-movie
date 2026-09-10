from __future__ import annotations

import time
import uuid

from fastapi import Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logger import get_logger
from app.server.server import Middleware

request_logger = get_logger("api.access")


# #
# middleware

async def request_logging_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4())[:8])
    request.state.trace_id = trace_id

    if request.url.path in ("/health", "/"):
        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        return response

    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 1)
    response.headers["X-Trace-ID"] = trace_id

    error_body = None
    if response.status_code >= 400:
        body = b""
        async for chunk in response.body_iterator:
            body += chunk.encode("utf-8") if isinstance(chunk, str) else chunk
        error_body = body.decode("utf-8", errors="replace")[:1000]
        # body_iterator를 소비했으므로 응답을 새로 구성
        response = Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    extra = {
        "trace_id": trace_id,
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "duration_ms": duration_ms,
        "client_ip": request.client.host if request.client else None,
    }
    if error_body:
        extra["response_body"] = error_body

    log = request_logger.warning if response.status_code >= 400 else request_logger.info
    log(
        f"{request.method} {request.url.path} {response.status_code} {duration_ms}ms",
        extra=extra,
    )
    return response


# #
# factory

def cors() -> Middleware:
    return Middleware(
        cls=CORSMiddleware,
        allow_origins=[
            settings.FRONTEND_URL,
            "http://localhost:3503",
            "http://localhost:8081",
        ],
        # 개발 중엔 같은 망의 다른 기기(휴대폰·다른 PC)에서도 연다 — 사설 IP 대역만.
        # 운영에서는 켜지 않는다(오리진 검사가 사실상 무력해진다).
        allow_origin_regex=(
            r"http://(localhost|127\.0\.0\.1|(10|127)(\.\d{1,3}){3}"
            r"|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2}):\d+"
            if settings.APP_ENV != "production"
            else None
        ),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Permission-Version", "X-Conversation-Id"],
    )


def permission_version() -> Middleware:
    async def permission_version_header_middleware(request: Request, call_next):
        # opt-in echo — 요청이 X-Permission-Version을 보낸 경우만. 값은 behavior
        # RequirePermissionVersion이 request.state에 stash한 server truth.
        response = await call_next(request)
        if request.headers.get("X-Permission-Version") is not None:
            version = getattr(request.state, "permissions_version", None)
            if version is not None:
                response.headers["X-Permission-Version"] = str(version)
        return response
    
    return Middleware(func=permission_version_header_middleware)


def request_logging() -> Middleware:
    return Middleware(func=request_logging_middleware)
