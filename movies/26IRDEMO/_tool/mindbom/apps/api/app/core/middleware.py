"""애플리케이션 미들웨어"""
import time
import uuid
from fastapi import Request, Response
from app.core.logger import get_logger
from app.core.request_context import set_trace_id

request_logger = get_logger("api.access")


async def request_logging_middleware(request: Request, call_next):
    """HTTP 요청/응답 로깅 + trace_id 생성

    ContextVar에도 trace_id를 바인딩하여 핸들러/감사 로그에서 자동 캡처되도록 함.
    """
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4())[:8])
    request.state.trace_id = trace_id
    set_trace_id(trace_id)

    if request.url.path in ("/health", "/"):
        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        return response

    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 1)

    response.headers["X-Trace-ID"] = trace_id

    error_body = None
    if response.status_code >= 400:
        body_bytes = b""
        async for chunk in response.body_iterator:
            if isinstance(chunk, str):
                body_bytes += chunk.encode("utf-8")
            else:
                body_bytes += chunk
        error_body = body_bytes.decode("utf-8", errors="replace")[:1000]
        response = Response(
            content=body_bytes,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    log_level = "warning" if response.status_code >= 400 else "info"
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

    getattr(request_logger, log_level)(
        f"{request.method} {request.url.path} {response.status_code} {duration_ms}ms",
        extra=extra,
    )

    return response
