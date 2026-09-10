"""데이터베이스 연결 및 세션 관리"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from app.core.config import settings


engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Dependency용 DB 세션 생성기"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """데이터베이스 초기화 (개발 환경 전용)"""
    from app.core.models import BaseModel

    # 모든 모듈의 models import (metadata 등록)
    from app.modules.auth.account.models import Account  # noqa: F401
    from app.modules.auth.token.models import RefreshToken  # noqa: F401
    from app.modules.institution.models import Institution  # noqa: F401
    from app.modules.member.models import Member  # noqa: F401
    from app.modules.client.models import Client  # noqa: F401
    from app.modules.examination.common.models import Examination  # noqa: F401
    from app.modules.audit.models import AuditLog  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)


async def close_db() -> None:
    """데이터베이스 연결 종료"""
    await engine.dispose()
