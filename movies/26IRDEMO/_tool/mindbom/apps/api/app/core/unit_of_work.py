"""Unit of Work 패턴 구현 (트랜잭션 경계 관리)"""
from typing import Any, AsyncIterator, TypeVar
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal


T = TypeVar("T")


class UnitOfWork:
    """
    Unit of Work 패턴

    트랜잭션 경계를 명확히 정의하고, 여러 Repository를 하나의 트랜잭션으로 묶음.
    Core 레이어이므로 modules에 의존하지 않음.

    Usage:
        async with uow:
            facade = ExaminationFacade(uow)
            result = await facade.create_examination(...)
            await uow.commit()
    """

    def __init__(self, session: AsyncSession):
        self._session = session
        self._repositories: dict[type, Any] = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self.rollback()

    @property
    def session(self) -> AsyncSession:
        """현재 DB 세션 반환"""
        return self._session

    def repo(self, repo_class: type[T]) -> T:
        """Repository 인스턴스 반환 (Lazy Init + Caching)"""
        if repo_class not in self._repositories:
            self._repositories[repo_class] = repo_class(self._session)  # type: ignore[call-arg]
        return self._repositories[repo_class]

    async def commit(self):
        await self._session.commit()

    async def rollback(self):
        await self._session.rollback()

    async def flush(self):
        await self._session.flush()


async def get_uow() -> AsyncIterator[UnitOfWork]:
    """UnitOfWork 생성기 (FastAPI Depends용)"""
    async with AsyncSessionLocal() as session:
        yield UnitOfWork(session)
