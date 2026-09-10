"""Base Repository 클래스"""
from typing import Any, Generic, TypeVar, Type
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import BaseModel

ModelType = TypeVar("ModelType", bound=BaseModel)


class BaseRepository(Generic[ModelType]):
    """
    모든 Repository의 기본 클래스

    - CRUD 기본 메서드
    - Session 관리 (UnitOfWork와 함께 사용)
    - commit하지 않음 (UoW가 담당)
    """

    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self._session = session

    async def get(self, id: str, include_deleted: bool = False) -> ModelType | None:
        """UUID로 단일 엔티티 조회"""
        entity = await self._session.get(self.model, id)
        if entity and not include_deleted and hasattr(entity, "deleted_at") and entity.deleted_at is not None:
            return None
        return entity

    async def get_by_id(self, id: str, include_deleted: bool = False) -> ModelType | None:
        """get의 alias"""
        return await self.get(id, include_deleted=include_deleted)

    async def list(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False,
        **filters: Any,
    ) -> list[ModelType]:
        """엔티티 목록 조회 (페이징 지원)"""
        stmt = select(self.model)
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        for key, value in filters.items():
            if hasattr(self.model, key):
                stmt = stmt.where(getattr(self.model, key) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count(self, include_deleted: bool = False, **filters: Any) -> int:
        """엔티티 개수 조회"""
        from sqlalchemy import func

        stmt = select(func.count()).select_from(self.model)
        if not include_deleted and hasattr(self.model, "deleted_at"):
            stmt = stmt.where(self.model.deleted_at.is_(None))
        for key, value in filters.items():
            if hasattr(self.model, key):
                stmt = stmt.where(getattr(self.model, key) == value)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def create(self, data: dict[str, Any]) -> ModelType:
        """새 엔티티 생성"""
        entity = self.model(**data)
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def update(self, id: str, data: dict[str, Any]) -> ModelType | None:
        """엔티티 수정"""
        stmt = (
            update(self.model)
            .where(self.model.id == id)
            .values(**data)
            .returning(self.model)
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.scalar_one_or_none()

    async def delete(self, id: str) -> bool:
        """엔티티 Soft Delete"""
        from app.core.datetime_utils import utc_now

        entity = await self.get(id)
        if not entity:
            return False
        entity.deleted_at = utc_now()
        await self._session.flush()
        return True

    def add(self, entity: ModelType) -> None:
        """엔티티를 세션에 추가 (flush 없이)"""
        self._session.add(entity)

    async def flush(self) -> None:
        """변경사항을 DB에 반영 (commit 없이)"""
        await self._session.flush()

    async def refresh(self, entity: ModelType) -> None:
        """엔티티를 DB에서 다시 로드"""
        await self._session.refresh(entity)

    async def hard_delete(self, id: str) -> bool:
        """물리적 삭제 (특별한 경우에만 사용)"""
        stmt = delete(self.model).where(self.model.id == id)
        result = await self._session.execute(stmt)
        await self._session.flush()
        return result.rowcount > 0
