from datetime import datetime

from sqlalchemy import or_, type_coerce
from sqlalchemy.dialects.postgresql import JSONB

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import AssessmentSet


class AssessmentSetRepository(PostgresRepository[AssessmentSet]):
    model = AssessmentSet

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        name: str,
        assessment_summary: list,
        description: str | None = None,
        center_member_summary: list | None = None,
    ) -> AssessmentSet:
        return await super().add(
            AssessmentSet(
                center_id=center_id,
                name=name,
                assessment_summary=assessment_summary,
                description=description,
                center_member_summary=center_member_summary,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        set_id: uuid_str,
        center_id: uuid_str,
        *,
        name: str = unset,
        description: str | None = unset,
        assessment_summary: list = unset,
        center_member_summary: list | None = unset,
    ) -> AssessmentSet:
        await self.get_in_center(center_id=center_id, set_id=set_id)
        updated = await self.update_fields(
            set_id,
            name=name,
            description=description,
            assessment_summary=assessment_summary,
            center_member_summary=center_member_summary,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_center(
        self,
        set_id: uuid_str,
        center_id: uuid_str,
    ) -> AssessmentSet | None:
        await self.get_in_center(center_id=center_id, set_id=set_id)
        return await self.remove_by_id(set_id)

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        center_id: uuid_str,
        set_id: uuid_str,
    ) -> AssessmentSet | None:
        return await self._find(
            where=[
                AssessmentSet.center_id == center_id,
                AssessmentSet.id == set_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        center_id: uuid_str,
        set_id: uuid_str,
    ) -> AssessmentSet:
        assessment_set = await self.find_in_center(center_id=center_id, set_id=set_id)
        if assessment_set is None:
            raise EntityNotFoundException(f"AssessmentSet not found: {set_id}")
        return assessment_set

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        search: str | None = None,
        assessment_type: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AssessmentSet], Page]:
        return await self._page(
            where=self._build_conditions(
                center_id=center_id,
                search=search,
                assessment_type=assessment_type,
                created_from=created_from,
                created_to=created_to,
            ),
            page=page,
            size=size,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_ids(self, set_ids: list[str]) -> list[AssessmentSet]:
        if not set_ids:
            return []
        return await self._filter(where=[AssessmentSet.id.in_(set_ids)])

    # #
    # helpers

    def _build_conditions(
        self,
        center_id: str,
        search: str | None = None,
        assessment_type: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> list:
        where: list = [AssessmentSet.center_id == center_id]
        if search:
            like = f"%{search}%"
            where.append(
                or_(
                    AssessmentSet.name.ilike(like),
                    AssessmentSet.description.ilike(like),
                )
            )
        if assessment_type:
            where.append(
                AssessmentSet.assessment_summary.op("@>")(
                    type_coerce([{"type": assessment_type}], JSONB)
                )
            )
        if created_from is not None:
            where.append(AssessmentSet.created_at >= created_from)
        if created_to is not None:
            where.append(AssessmentSet.created_at <= created_to)
        return where
