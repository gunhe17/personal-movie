from math import ceil

from sqlalchemy import func, select

from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import LabSampleDataset


class LabSampleDatasetRepository(PostgresRepository[LabSampleDataset]):
    model = LabSampleDataset

    # #
    # command

    @typecheck
    async def add(
        self,
        name: str,
        input_type: str,
        description: str | None = None,
        text_content: str | None = None,
        s3_key: str | None = None,
        audio_duration: float | None = None,
        audio_file_size: int | None = None,
        tags: str | None = None,
        source_type: str | None = None,
        field_note_id: uuid_str | None = None,
        author_id: uuid_str | None = None,
        usage_count: int = 0,
    ) -> LabSampleDataset:
        return await super().add(
            LabSampleDataset(
                name=name,
                input_type=input_type,
                description=description,
                text_content=text_content,
                s3_key=s3_key,
                audio_duration=audio_duration,
                audio_file_size=audio_file_size,
                tags=tags,
                source_type=source_type,
                field_note_id=field_note_id,
                author_id=author_id,
                usage_count=usage_count,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        name: str = unset,
        description: str | None = unset,
        text_content: str | None = unset,
        tags: str | None = unset,
        reference_segments: str | None = unset,
    ) -> LabSampleDataset | None:
        return await self.update_fields(
            id,
            name=name,
            description=description,
            text_content=text_content,
            tags=tags,
            reference_segments=reference_segments,
        )

    # #
    # query

    @typecheck
    async def list_with_page(
        self,
        input_type: str | None = None,
        tags: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[LabSampleDataset], Page]:
        conditions = [LabSampleDataset.deleted_at.is_(None)]
        if input_type:
            conditions.append(LabSampleDataset.input_type == input_type)
        if tags:
            conditions.append(LabSampleDataset.tags.like(f"%{tags}%"))

        total = await self._session.scalar(
            select(func.count()).select_from(LabSampleDataset).where(*conditions)
        ) or 0
        stmt = (
            select(LabSampleDataset)
            .where(*conditions)
            .order_by(LabSampleDataset.last_used_at.desc(), LabSampleDataset.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        items = await self._scalars(stmt)
        return items, Page(
            total=total,
            page=page,
            size=size,
            pages=ceil(total / size) if size else 0,
        )

    @typecheck
    async def list_imported_field_note_ids(
        self,
        field_note_ids: list[str],
    ) -> set[str]:
        if not field_note_ids:
            return set()
        stmt = select(LabSampleDataset.field_note_id).where(
            LabSampleDataset.field_note_id.in_(field_note_ids),
            LabSampleDataset.field_note_id.isnot(None),
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return {r for r in rows if r}
