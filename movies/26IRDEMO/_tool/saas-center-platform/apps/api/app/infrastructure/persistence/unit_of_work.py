from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, TypeVar
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.persistence.database import AsyncSessionLocal


T = TypeVar("T")


class UnitOfWork:
    """트랜잭션 경계를 여러 Repository에 걸쳐 하나로 묶는다.

    모든 repo가 같은 세션을 공유해 일관성을 보장하고, context manager 종료 시
    예외가 있으면 자동 rollback 한다. repo는 lazy 생성/캐싱.
    """

    def __init__(self, session: AsyncSession):
        self._session = session
        self._repositories: dict[type, Any] = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # 예외 시에만 rollback. 정상 종료의 미커밋 트랜잭션은 세션 close에서 정리된다.
        if exc_type:
            await self.rollback()

    @property
    def session(self) -> AsyncSession:
        # raw query 등 Repository 외 접근용
        return self._session

    def repo(self, repo_class: type[T]) -> T:
        if repo_class not in self._repositories:
            self._repositories[repo_class] = repo_class(self._session)  # type: ignore[call-arg]
        return self._repositories[repo_class]

    async def commit(self):
        await self._session.commit()

    async def rollback(self):
        await self._session.rollback()

    async def flush(self):
        await self._session.flush()

    async def reject(self, exc: Exception):
        # 거부하되 흔적 보존 — 현재 tx commit 후 raise (eventing.md §7)
        await self._session.commit()
        raise exc

    async def try_advisory_xact_lock(self, key: int) -> bool:
        # 트랜잭션 레벨 advisory lock — 커밋/롤백 시 자동 해제(수동 unlock·leak 없음).
        # 멀티 레플리카 중 1개만 실행하는 cron 등에서 사용. 핸들러는 tx-free여야 함(중간 커밋=조기 해제).
        from sqlalchemy import text

        result = await self._session.execute(
            text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": key}
        )
        return bool(result.scalar())


@asynccontextmanager
async def transactional_uow() -> AsyncIterator[UnitOfWork]:
    """새 세션 + clean exit 자동 commit / 예외 rollback — behavior request flow·워커가 소유.
    스트림은 behavior.stream이 AsyncSessionLocal 수동 커밋으로 별도 관리 (eventing.md §9)."""
    async with AsyncSessionLocal() as session:
        uow = UnitOfWork(session)
        try:
            yield uow
            await session.commit()
        except Exception:
            await session.rollback()
            raise
