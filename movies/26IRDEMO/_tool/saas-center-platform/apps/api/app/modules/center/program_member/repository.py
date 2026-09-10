from sqlalchemy import func, select
from sqlalchemy import update as sql_update

from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import ProgramMember


class ProgramMemberRepository(PostgresRepository[ProgramMember]):
    model = ProgramMember

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        program_id: uuid_str,
        member_id: uuid_str,
    ) -> ProgramMember:
        return await super().add(
            ProgramMember(
                center_id=center_id,
                program_id=program_id,
                member_id=member_id,
            )
        )

    @typecheck
    async def restore_by_id(
        self,
        id: uuid_str,
    ) -> ProgramMember | None:
        stmt = (
            sql_update(ProgramMember)
            .where(
                ProgramMember.id == id,
                ProgramMember.deleted_at.is_not(None),
            )
            .values(deleted_at=None, updated_at=func.now())
            .returning(ProgramMember)
        )
        model = (await self._session.execute(stmt)).scalars().first()
        await self._session.flush()
        return model

    # #
    # query

    @typecheck
    async def list_by_program(
        self,
        program_id: uuid_str,
    ) -> list[ProgramMember]:
        return await self._filter(
            where=[ProgramMember.program_id == program_id],
            order_by="created_at",
        )


    @typecheck
    async def get_in_center(
        self,
        program_id: uuid_str,
        member_id: uuid_str,
        center_id: uuid_str,
    ) -> ProgramMember:
        pm = await self._find(
            where=[
                ProgramMember.program_id == program_id,
                ProgramMember.member_id == member_id,
                ProgramMember.center_id == center_id,
            ]
        )
        if pm is None:
            raise EntityNotFoundException(
                f"ProgramMember not found: program={program_id}, member={member_id}"
            )
        return pm

    @typecheck
    async def list_existing_member_ids(
        self,
        program_id: uuid_str,
        member_ids: list[str],
    ) -> set[str]:
        if not member_ids:
            return set()

        query = select(ProgramMember.member_id).where(
            ProgramMember.program_id == program_id,
            ProgramMember.member_id.in_(member_ids),
            ProgramMember.deleted_at.is_(None),
        )
        result = await self._session.execute(query)
        return set(result.scalars().all())

    @typecheck
    async def find_deleted_only(
        self,
        program_id: uuid_str,
        member_id: uuid_str,
    ) -> ProgramMember | None:
        query = select(ProgramMember).where(
            ProgramMember.program_id == program_id,
            ProgramMember.member_id == member_id,
            ProgramMember.deleted_at.is_not(None),
        )
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    @typecheck
    async def list_by_program_ids(
        self,
        program_ids: list[str],
    ) -> list[ProgramMember]:
        if not program_ids:
            return []

        return await self._filter(where=[ProgramMember.program_id.in_(program_ids)])

    @typecheck
    async def list_by_member_ids(
        self,
        member_ids: list[str],
        center_id: uuid_str,
    ) -> list[ProgramMember]:
        if not member_ids:
            return []

        return await self._filter(
            where=[
                ProgramMember.member_id.in_(member_ids),
                ProgramMember.center_id == center_id,
            ]
        )
