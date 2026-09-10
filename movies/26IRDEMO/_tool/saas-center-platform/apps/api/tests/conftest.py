"""pytest configuration and fixtures"""
import asyncio
from typing import AsyncGenerator
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.infrastructure.persistence.models import BaseModel
from app.main import app


# Test database URL
# 로컬 실행: localhost:3501 (Docker 포트 매핑)
# 안전 가드: 반드시 *_test DB만 사용 — 개발 DB(imomtae)를 drop/truncate하지 않도록.
TEST_DATABASE_URL = "postgresql+asyncpg://imomtae:imomtae_dev@localhost:3501/imomtae_test"

_DB_NAME = TEST_DATABASE_URL.rsplit("/", 1)[-1]

# Global flag to track if tables are created
_tables_created = False


@pytest.fixture(scope="function")
async def test_engine():
    """Create a test database engine (function-scoped for event loop compatibility)"""
    if not _DB_NAME.endswith("_test"):
        pytest.skip(
            f"DB fixture는 *_test DB에서만 동작 (현재: {_DB_NAME}) — 개발 DB 보호"
        )
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )

    yield engine

    # Cleanup after test - ensure complete disposal
    await engine.dispose()
    await engine.dispose()  # Double dispose to ensure cleanup


@pytest.fixture(scope="function")
async def cleanup_db(test_engine):
    """Clean up database before each test (and create tables on first run)"""
    global _tables_created

    # Create tables on first run
    if not _tables_created:
        async with test_engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.drop_all)
            await conn.run_sync(BaseModel.metadata.create_all)
        _tables_created = True
        # Dispose after table creation to ensure clean state
        await test_engine.dispose()

    # Clean up before test
    async with test_engine.begin() as conn:
        # 자가치유: 풀 스위트에서 간헐적으로 테이블이 사라지는 결함(TRUNCATE UndefinedTable) 대비 — checkfirst 재생성
        await conn.run_sync(BaseModel.metadata.create_all)
        # Disable foreign key checks temporarily
        await conn.execute(__import__("sqlalchemy").text("SET session_replication_role = 'replica'"))

        # Truncate all tables
        for table in reversed(BaseModel.metadata.sorted_tables):
            await conn.execute(__import__("sqlalchemy").text(f"TRUNCATE TABLE {table.name} CASCADE"))

        # Re-enable foreign key checks
        await conn.execute(__import__("sqlalchemy").text("SET session_replication_role = 'origin'"))

    yield

    # Clean up after test
    async with test_engine.begin() as conn:
        await conn.execute(__import__("sqlalchemy").text("SET session_replication_role = 'replica'"))
        for table in reversed(BaseModel.metadata.sorted_tables):
            await conn.execute(__import__("sqlalchemy").text(f"TRUNCATE TABLE {table.name} CASCADE"))
        await conn.execute(__import__("sqlalchemy").text("SET session_replication_role = 'origin'"))


@pytest.fixture(scope="function")
async def test_session(test_engine, cleanup_db) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session (after cleanup_db)"""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session

    # Ensure engine is disposed after session closes
    await test_engine.dispose()


@pytest.fixture(scope="function")
async def test_client(test_session) -> AsyncGenerator[AsyncClient, None]:
    """
    FastAPI TestClient (httpx AsyncClient)

    Usage:
        async def test_example(test_client):
            response = await test_client.post("/auth/signup", json={...})
            assert response.status_code == 201
    """
    app.dependency_overrides.clear()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def seed_roles(test_session):
    """시드 데이터: 역할 및 권한"""
    from scripts.seed.common.role import seed_roles, seed_permissions, seed_role_permissions

    await seed_roles(test_session)
    await seed_permissions(test_session)
    await seed_role_permissions(test_session)


@pytest.fixture(scope="function")
async def seed_assessments(test_session):
    """시드 데이터: 아동 심리 검사"""
    from scripts.seed.common.assessment import seed_assessments

    await seed_assessments(test_session)
