"""데이터베이스 연결 및 세션 관리 (DB 어댑터).

P2(2026-06-15): core에서 이전. 엔진/세션은 외부 시스템(PostgreSQL) 어댑터 = infra.
스키마 생성(init_db, 전 모듈 모델 등록)은 조립 관심사라 `app/server/lifecycle.py`(init_db)로 분리.
"""

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from app.core.config import settings


engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # 연결 유효성 검사 후 대여
    pool_size=10,
    max_overflow=20,
)


AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,  # commit 후에도 객체 접근 가능
    autoflush=False,  # flush를 명시적으로만
)


async def close_db() -> None:
    await engine.dispose()
