"""FastAPI application entry point — MindBom (마인드봄)"""
import traceback
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.formparsers import MultiPartParser

# multipart 파서 part 크기 한계 상향 (Starlette 기본 1MB)
# 검사 오디오 등 대용량 multipart 업로드 지원. 실제 업로드 한계는 라우트별 게이트가 강제.
MultiPartParser.max_part_size = 100 * 1024 * 1024  # 100MB
MultiPartParser.spool_max_size = 100 * 1024 * 1024  # 100MB

from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.logger import setup_logging, get_logger
from app.core.middleware import request_logging_middleware
from app.core.exceptions import (
    AccountLockedException,
    ExternalServiceException,
    EntityNotFoundException,
    PermissionDeniedException,
    InvalidOperationException,
    ConflictException,
    UnauthorizedException,
    InvalidStateTransitionException,
)

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 생명주기 관리"""
    setup_logging()

    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"AI Service: {'Enabled' if settings.AI_SERVICE_ENABLED else 'Mock'}")
    logger.info(f"Audit Trail: {'Enabled' if settings.AUDIT_ENABLED else 'Disabled'}")

    if settings.APP_ENV == "development":
        logger.info("Initializing database tables...")
        await init_db()
        logger.info("Database tables ready")

    yield

    logger.info("Shutting down...")
    await close_db()
    logger.info("Cleanup complete")


app = FastAPI(
    title=settings.APP_NAME,
    description="투사적 심리검사 해석 보조 시스템 (SaMD 2등급)",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(request_logging_middleware)


# === Domain Exception Handlers ===

@app.exception_handler(EntityNotFoundException)
async def entity_not_found_handler(request: Request, exc: EntityNotFoundException):
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": exc.message})


@app.exception_handler(PermissionDeniedException)
async def permission_denied_handler(request: Request, exc: PermissionDeniedException):
    return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": exc.message})


@app.exception_handler(InvalidOperationException)
async def invalid_operation_handler(request: Request, exc: InvalidOperationException):
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": exc.message})


@app.exception_handler(ConflictException)
async def conflict_handler(request: Request, exc: ConflictException):
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": exc.message})


@app.exception_handler(UnauthorizedException)
async def unauthorized_handler(request: Request, exc: UnauthorizedException):
    return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": exc.message})


@app.exception_handler(InvalidStateTransitionException)
async def invalid_state_handler(request: Request, exc: InvalidStateTransitionException):
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": exc.message})


@app.exception_handler(AccountLockedException)
async def account_locked_handler(request: Request, exc: AccountLockedException):
    return JSONResponse(status_code=status.HTTP_423_LOCKED, content={"detail": exc.message})


@app.exception_handler(ExternalServiceException)
async def external_service_handler(request: Request, exc: ExternalServiceException):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": exc.message}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 처리"""
    trace_id = getattr(request.state, "trace_id", str(uuid.uuid4())[:8])
    error_id = str(uuid.uuid4())

    logger.error(
        f"Unhandled exception [trace_id: {trace_id}] [error_id: {error_id}] "
        f"{request.method} {request.url.path} - {type(exc).__name__}: {str(exc)}",
        extra={"trace_id": trace_id, "error_id": error_id},
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
        content={"detail": "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요."},
    )


# === Health Check ===

@app.get("/")
async def root():
    return {
        "status": "ok",
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# === Module Routers ===
from app.modules.auth.router import router as auth_router
from app.modules.audit.router import router as audit_router
from app.modules.client.router import router as client_router
from app.modules.examination.router import router as examination_router
from app.modules.examination.htp.router import router as htp_router
from app.modules.examination.rorschach.router import router as rorschach_router
from app.modules.examination.sct.router import router as sct_router
from app.modules.comprehensive_report.router import router as comprehensive_report_router
from app.modules.institution.router import router as institution_router
from app.modules.invitation.router import (
    admin_router as invitation_admin_router,
    public_router as invitation_public_router,
)
from app.modules.member.router import router as member_router
from app.modules.notification.router import router as notification_router
from app.modules.storage.router import router as storage_router
from app.modules.transcription.router import router as transcription_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(client_router, prefix="/api/v1")
app.include_router(examination_router, prefix="/api/v1")
app.include_router(htp_router, prefix="/api/v1")
app.include_router(rorschach_router, prefix="/api/v1")
app.include_router(sct_router, prefix="/api/v1")
app.include_router(comprehensive_report_router, prefix="/api/v1")
app.include_router(institution_router, prefix="/api/v1")
app.include_router(invitation_admin_router, prefix="/api/v1")
app.include_router(invitation_public_router, prefix="/api/v1")
app.include_router(member_router, prefix="/api/v1")
app.include_router(notification_router, prefix="/api/v1")
app.include_router(storage_router, prefix="/api/v1")
app.include_router(transcription_router, prefix="/api/v1")

# TODO: 추가 모듈 개발 시 라우터 등록
# from app.modules.institution.router import router as institution_router
# from app.modules.member.router import router as member_router
# from app.modules.client.router import router as client_router
# from app.modules.examination.router import router as examination_router
# from app.modules.dashboard.router import router as dashboard_router
# from app.modules.audit.router import router as audit_router
#
# app.include_router(institution_router, prefix="/api/v1")
# app.include_router(member_router, prefix="/api/v1")
# app.include_router(client_router, prefix="/api/v1")
# app.include_router(examination_router, prefix="/api/v1")
# app.include_router(dashboard_router, prefix="/api/v1")
# app.include_router(audit_router, prefix="/api/v1")
