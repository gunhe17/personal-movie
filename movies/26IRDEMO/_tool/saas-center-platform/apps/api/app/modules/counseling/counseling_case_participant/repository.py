from sqlalchemy import distinct, select

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CounselingCaseParticipant
from .models import CaseParticipantType


class CounselingCaseParticipantRepository(PostgresRepository[CounselingCaseParticipant]):
    model = CounselingCaseParticipant

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        counseling_case_id: uuid_str,
        participant_id: uuid_str,
        participant_type: str,
        is_active: bool,
        joined_at: utc_dt,
        left_at: utc_dt | None = None,
    ) -> CounselingCaseParticipant:
        return await super().add(
            CounselingCaseParticipant(
                center_id=center_id,
                counseling_case_id=counseling_case_id,
                participant_id=participant_id,
                participant_type=participant_type,
                is_active=is_active,
                joined_at=joined_at,
                left_at=left_at,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        participant_id: uuid_str,
        center_id: uuid_str,
        *,
        is_active: bool = unset,
        left_at: utc_dt | None = unset,
    ) -> CounselingCaseParticipant:
        await self.get_in_center(participant_id=participant_id, center_id=center_id)
        updated = await self.update_fields(
            participant_id,
            is_active=is_active,
            left_at=left_at,
        )
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def list_by_case(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
        active_only: bool = False,
        participant_type: str | None = None,
    ) -> list[CounselingCaseParticipant]:
        conditions = [
            CounselingCaseParticipant.counseling_case_id == case_id,
            CounselingCaseParticipant.center_id == center_id,
            CounselingCaseParticipant.deleted_at.is_(None),
        ]
        if active_only:
            conditions.append(CounselingCaseParticipant.is_active.is_(True))
        if participant_type:
            conditions.append(CounselingCaseParticipant.participant_type == participant_type)

        stmt = (
            select(CounselingCaseParticipant)
            .where(*conditions)
            .order_by(CounselingCaseParticipant.joined_at)
        )
        return await self._scalars(stmt)

    @typecheck
    async def find_in_center(
        self,
        participant_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingCaseParticipant | None:
        return await self._find(
            where=[
                CounselingCaseParticipant.id == participant_id,
                CounselingCaseParticipant.center_id == center_id,
            ]
        )

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str = "desc",
        limit: int = 200,
        participant_type: str | None = None,
        active_only: bool = True,
        case_ids: list[str] | None = None,
        participant_ids: list[str] | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[CounselingCaseParticipant], int]:
        # 앵커(case/participant/id) 없이는 junction 전량 스캔 금지
        if not (case_ids or participant_ids or ids):
            return [], 0
        where = [CounselingCaseParticipant.center_id == center_id]
        if ids:
            where.append(CounselingCaseParticipant.id.in_(ids))
        if case_ids:
            where.append(CounselingCaseParticipant.counseling_case_id.in_(case_ids))
        if participant_ids:
            where.append(CounselingCaseParticipant.participant_id.in_(participant_ids))
        if participant_type:
            where.append(CounselingCaseParticipant.participant_type == participant_type)
        if active_only:
            where.append(CounselingCaseParticipant.is_active.is_(True))
        rows = await self._filter(
            where=where, order_by="joined_at", descending=sort != "asc", limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def get_in_center(
        self,
        participant_id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingCaseParticipant:
        participant = await self.find_in_center(
            participant_id=participant_id,
            center_id=center_id,
        )
        if participant is None:
            raise EntityNotFoundException(
                f"CounselingCaseParticipant not found: {participant_id}"
            )
        return participant

    @typecheck
    async def find_active_participant(
        self,
        case_id: uuid_str,
        participant_id: uuid_str,
    ) -> CounselingCaseParticipant | None:
        return await self._find(
            where=[
                CounselingCaseParticipant.counseling_case_id == case_id,
                CounselingCaseParticipant.participant_id == participant_id,
                CounselingCaseParticipant.is_active.is_(True),
            ]
        )

    @typecheck
    async def count_active(self, case_id: uuid_str) -> int:
        return await self._count(
            where=[
                CounselingCaseParticipant.counseling_case_id == case_id,
                CounselingCaseParticipant.is_active.is_(True),
            ]
        )

    @typecheck
    async def list_case_ids_by_participant_ids(
        self,
        participant_ids: list[str],
        center_id: uuid_str,
    ) -> list[str]:
        if not participant_ids:
            return []

        stmt = select(distinct(CounselingCaseParticipant.counseling_case_id)).where(
            CounselingCaseParticipant.participant_id.in_(participant_ids),
            CounselingCaseParticipant.center_id == center_id,
            CounselingCaseParticipant.is_active.is_(True),
            CounselingCaseParticipant.participant_type == CaseParticipantType.CLIENT.value,
            CounselingCaseParticipant.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_case_ids_by_counselor_member(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
        *,
        active_only: bool = False,
    ) -> list[str]:
        where = [
            CounselingCaseParticipant.participant_id == member_id,
            CounselingCaseParticipant.center_id == center_id,
            CounselingCaseParticipant.participant_type == CaseParticipantType.COUNSELOR.value,
            CounselingCaseParticipant.deleted_at.is_(None),
        ]
        if active_only:
            where.append(CounselingCaseParticipant.is_active.is_(True))

        stmt = select(distinct(CounselingCaseParticipant.counseling_case_id)).where(*where)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_all_client_ids_by_case_ids(
        self,
        case_ids: list[str],
    ) -> list[str]:
        if not case_ids:
            return []

        stmt = select(distinct(CounselingCaseParticipant.participant_id)).where(
            CounselingCaseParticipant.counseling_case_id.in_(case_ids),
            CounselingCaseParticipant.participant_type == CaseParticipantType.CLIENT.value,
            CounselingCaseParticipant.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_by_participant_ids(
        self,
        participant_ids: list[str],
        center_id: uuid_str,
        active_only: bool = False,
        participant_type: str | None = None,
    ) -> list[CounselingCaseParticipant]:
        if not participant_ids:
            return []

        conditions = [
            CounselingCaseParticipant.participant_id.in_(participant_ids),
            CounselingCaseParticipant.center_id == center_id,
            CounselingCaseParticipant.deleted_at.is_(None),
        ]
        if active_only:
            conditions.append(CounselingCaseParticipant.is_active.is_(True))
        if participant_type:
            conditions.append(CounselingCaseParticipant.participant_type == participant_type)

        stmt = (
            select(CounselingCaseParticipant)
            .where(*conditions)
            .order_by(CounselingCaseParticipant.joined_at)
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_by_case_ids(self, case_ids: list[str]) -> list[CounselingCaseParticipant]:
        if not case_ids:
            return []

        stmt = (
            select(CounselingCaseParticipant)
            .where(CounselingCaseParticipant.counseling_case_id.in_(case_ids))
            .where(CounselingCaseParticipant.is_active.is_(True))
            .where(CounselingCaseParticipant.deleted_at.is_(None))
            .order_by(CounselingCaseParticipant.joined_at)
        )
        return await self._scalars(stmt)

    @typecheck
    async def aggregate_active_client_ids_by_case_ids(
        self,
        case_ids: list[str],
    ) -> dict[str, list[str]]:
        if not case_ids:
            return {}

        stmt = select(
            CounselingCaseParticipant.counseling_case_id,
            CounselingCaseParticipant.participant_id,
        ).where(
            CounselingCaseParticipant.counseling_case_id.in_(case_ids),
            CounselingCaseParticipant.participant_type == CaseParticipantType.CLIENT.value,
            CounselingCaseParticipant.is_active.is_(True),
            CounselingCaseParticipant.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        out: dict[str, list[str]] = {}
        for row in result.all():
            out.setdefault(row.counseling_case_id, []).append(row.participant_id)
        return out

    @typecheck
    async def aggregate_active_counselors_by_case_ids(
        self,
        case_ids: list[str],
    ) -> dict[str, list[str]]:
        if not case_ids:
            return {}

        stmt = select(
            CounselingCaseParticipant.counseling_case_id,
            CounselingCaseParticipant.participant_id,
        ).where(
            CounselingCaseParticipant.counseling_case_id.in_(case_ids),
            CounselingCaseParticipant.participant_type == CaseParticipantType.COUNSELOR.value,
            CounselingCaseParticipant.is_active.is_(True),
            CounselingCaseParticipant.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        out: dict[str, list[str]] = {}
        for row in result.all():
            out.setdefault(row.counseling_case_id, []).append(row.participant_id)
        return out
