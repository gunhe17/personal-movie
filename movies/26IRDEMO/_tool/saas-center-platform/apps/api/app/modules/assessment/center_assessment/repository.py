from sqlalchemy import select

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CenterAssessment


class CenterAssessmentRepository(PostgresRepository[CenterAssessment]):
    model = CenterAssessment

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        assessment_id: uuid_str,
        is_active: bool = True,
    ) -> CenterAssessment:
        return await super().add(
            CenterAssessment(
                center_id=center_id,
                assessment_id=assessment_id,
                is_active=is_active,
            )
        )

    @typecheck
    async def restore(self, id: uuid_str) -> CenterAssessment:
        record = await self._session.get(CenterAssessment, id)
        if record is None:
            raise EntityNotFoundException(f"CenterAssessment not found: {id}")
        record.deleted_at = None
        record.is_active = True
        await self._session.flush()
        await self._session.refresh(record)
        return record

    @typecheck
    async def update_in_center(
        self,
        center_id: uuid_str,
        assessment_id: uuid_str,
        *,
        is_active: bool = unset,
    ) -> CenterAssessment | None:
        record = await self.find_in_center(
            center_id=center_id,
            assessment_id=assessment_id,
        )
        if record is None:
            return None
        return await self.update_fields(record.id, is_active=is_active)

    @typecheck
    async def upsert_active(
        self,
        center_id: uuid_str,
        assessment_id: uuid_str,
        *,
        is_active: bool,
    ) -> CenterAssessment:
        record = await self.find_in_center(
            center_id=center_id,
            assessment_id=assessment_id,
        )
        if record is None:
            return await self.add(
                center_id=center_id,
                assessment_id=assessment_id,
                is_active=is_active,
            )
        updated = await self.update_fields(record.id, is_active=is_active)
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        center_id: uuid_str,
        assessment_id: uuid_str,
    ) -> CenterAssessment | None:
        return await self._find(
            where=[
                CenterAssessment.center_id == center_id,
                CenterAssessment.assessment_id == assessment_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        center_id: uuid_str,
        assessment_id: uuid_str,
    ) -> CenterAssessment:
        entity = await self.find_in_center(center_id=center_id, assessment_id=assessment_id)
        if entity is None:
            raise EntityNotFoundException(f"CenterAssessment not found: {assessment_id}")
        return entity

    @typecheck
    async def find_including_deleted(
        self,
        center_id: uuid_str,
        assessment_id: uuid_str,
    ) -> CenterAssessment | None:
        rows = await self._scalars(
            select(CenterAssessment).where(
                CenterAssessment.center_id == center_id,
                CenterAssessment.assessment_id == assessment_id,
            )
        )
        return rows[0] if rows else None

    @typecheck
    async def list_in_center(
        self,
        center_id: uuid_str,
        is_active: bool | None = None,
    ) -> list[CenterAssessment]:
        where = [CenterAssessment.center_id == center_id]
        if is_active is not None:
            where.append(CenterAssessment.is_active == is_active)
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_active_in_center(self, center_id: uuid_str) -> list[CenterAssessment]:
        return await self._filter(
            where=[
                CenterAssessment.center_id == center_id,
                CenterAssessment.is_active.is_(True),
            ],
            order_by="created_at",
            descending=True,
        )


    @typecheck
    async def list_active_assessment_ids(self, center_id: uuid_str) -> list[str]:
        records = await self.list_active_in_center(center_id=center_id)
        return [r.assessment_id for r in records]
