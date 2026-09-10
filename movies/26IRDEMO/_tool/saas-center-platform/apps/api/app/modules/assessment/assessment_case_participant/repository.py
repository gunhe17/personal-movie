from sqlalchemy import func, select, update as sql_update

from app.core.datetime_utils import utc_now
from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import AssessmentCaseParticipant


class AssessmentCaseParticipantRepository(
    PostgresRepository[AssessmentCaseParticipant]
):
    model = AssessmentCaseParticipant

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str = "desc",
        limit: int = 200,
        participant_type: str | None = None,
        case_ids: list[str] | None = None,
        participant_ids: list[str] | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[AssessmentCaseParticipant], int]:
        # 앵커(case/participant/id) 없이는 junction 전량 스캔 금지
        if not (case_ids or participant_ids or ids):
            return [], 0
        where = [
            AssessmentCaseParticipant.center_id == center_id,
            AssessmentCaseParticipant.unassigned_at.is_(None),
        ]
        if ids:
            where.append(AssessmentCaseParticipant.id.in_(ids))
        if case_ids:
            where.append(AssessmentCaseParticipant.case_id.in_(case_ids))
        if participant_ids:
            where.append(AssessmentCaseParticipant.participant_id.in_(participant_ids))
        if participant_type:
            where.append(AssessmentCaseParticipant.participant_type == participant_type)
        rows = await self._filter(
            where=where, order_by="assigned_at", descending=sort != "asc", limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> AssessmentCaseParticipant:
        return await super().add(
            AssessmentCaseParticipant(
                center_id=center_id,
                case_id=case_id,
                participant_type=participant_type,
                participant_id=participant_id,
            )
        )

    @typecheck
    async def add_or_reassign(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> AssessmentCaseParticipant:
        # full unique(case,type,participant)라, 같은 triple 의 기존 행이 있으면 재사용한다.
        # unassign(unassigned_at 마킹) · remove_by_case(soft delete) 둘 다 행을 남기므로
        # 미배정·소프트삭제 행을 모두 찾아 복원(unassigned_at·deleted_at 클리어). 없으면 신규.
        rows = await self._scalars(
            select(AssessmentCaseParticipant).where(
                AssessmentCaseParticipant.case_id == case_id,
                AssessmentCaseParticipant.participant_type == participant_type,
                AssessmentCaseParticipant.participant_id == participant_id,
            )
        )
        if rows:
            rec = rows[0]
            rec.deleted_at = None
            rec.unassigned_at = None
            rec.assigned_at = utc_now()
            await self._session.flush()
            return rec
        return await self.add(
            center_id=center_id,
            case_id=case_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )

    @typecheck
    async def update_unassigned(
        self,
        case_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> AssessmentCaseParticipant | None:
        record = await self.find_active(
            case_id=case_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )
        if record is None:
            return None
        updated = await self.update_fields(record.id, unassigned_at=utc_now())
        assert updated is not None
        return updated

    @typecheck
    async def remove_by_case(
        self, case_id: uuid_str
    ) -> list[AssessmentCaseParticipant]:
        # bulk soft-delete — 영향 행을 RETURNING으로 반환(per-row atomic 사실 기록)
        stmt = (
            sql_update(AssessmentCaseParticipant)
            .where(
                AssessmentCaseParticipant.case_id == case_id,
                AssessmentCaseParticipant.deleted_at.is_(None),
            )
            .values(deleted_at=func.now())
            .returning(AssessmentCaseParticipant)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    # #
    # query

    @typecheck
    async def find_active(
        self,
        case_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> AssessmentCaseParticipant | None:
        return await self._find(
            where=[
                AssessmentCaseParticipant.case_id == case_id,
                AssessmentCaseParticipant.participant_type == participant_type,
                AssessmentCaseParticipant.participant_id == participant_id,
                AssessmentCaseParticipant.unassigned_at.is_(None),
            ]
        )

    @typecheck
    async def list_by_case(self, case_id: uuid_str) -> list[AssessmentCaseParticipant]:
        return await self._filter(
            where=[
                AssessmentCaseParticipant.case_id == case_id,
                AssessmentCaseParticipant.unassigned_at.is_(None),
            ],
            order_by="assigned_at",
        )

    @typecheck
    async def list_by_case_and_type(
        self,
        case_id: uuid_str,
        participant_type: str,
    ) -> list[AssessmentCaseParticipant]:
        return await self._filter(
            where=[
                AssessmentCaseParticipant.case_id == case_id,
                AssessmentCaseParticipant.participant_type == participant_type,
                AssessmentCaseParticipant.unassigned_at.is_(None),
            ],
            order_by="assigned_at",
        )

    @typecheck
    async def list_by_case_ids(
        self, case_ids: list[str]
    ) -> list[AssessmentCaseParticipant]:
        if not case_ids:
            return []
        return await self._filter(
            where=[AssessmentCaseParticipant.case_id.in_(case_ids)]
        )

    @typecheck
    async def aggregate_client_ids_by_case_ids(
        self, case_ids: list[str]
    ) -> dict[str, list[str]]:
        if not case_ids:
            return {}
        stmt = select(
            AssessmentCaseParticipant.case_id,
            AssessmentCaseParticipant.participant_id,
        ).where(
            AssessmentCaseParticipant.case_id.in_(case_ids),
            AssessmentCaseParticipant.participant_type == "client",
            AssessmentCaseParticipant.unassigned_at.is_(None),
            AssessmentCaseParticipant.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        mapping: dict[str, list[str]] = {}
        for case_id, participant_id in result.all():
            mapping.setdefault(case_id, []).append(participant_id)
        return mapping

    @typecheck
    async def list_case_ids_by_client(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        active_only: bool = True,
    ) -> list[str]:
        conditions = [
            AssessmentCaseParticipant.center_id == center_id,
            AssessmentCaseParticipant.participant_type == "client",
            AssessmentCaseParticipant.participant_id == client_id,
            AssessmentCaseParticipant.deleted_at.is_(None),
        ]
        if active_only:
            conditions.append(AssessmentCaseParticipant.unassigned_at.is_(None))
        stmt = select(AssessmentCaseParticipant.case_id).where(*conditions).distinct()
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_case_ids_by_client_ids(
        self,
        center_id: uuid_str,
        client_ids: list[str],
    ) -> list[str]:
        if not client_ids:
            return []
        stmt = (
            select(AssessmentCaseParticipant.case_id)
            .where(
                AssessmentCaseParticipant.center_id == center_id,
                AssessmentCaseParticipant.participant_type == "client",
                AssessmentCaseParticipant.participant_id.in_(client_ids),
                AssessmentCaseParticipant.unassigned_at.is_(None),
                AssessmentCaseParticipant.deleted_at.is_(None),
            )
            .distinct()
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_case_ids_by_assistant(
        self,
        center_id: uuid_str,
        member_id: uuid_str,
    ) -> list[str]:
        stmt = (
            select(AssessmentCaseParticipant.case_id)
            .where(
                AssessmentCaseParticipant.center_id == center_id,
                AssessmentCaseParticipant.participant_type == "assistant",
                AssessmentCaseParticipant.participant_id == member_id,
                AssessmentCaseParticipant.deleted_at.is_(None),
            )
            .distinct()
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_all_client_ids_by_case_ids(self, case_ids: list[str]) -> list[str]:
        if not case_ids:
            return []
        stmt = (
            select(AssessmentCaseParticipant.participant_id)
            .where(
                AssessmentCaseParticipant.case_id.in_(case_ids),
                AssessmentCaseParticipant.participant_type == "client",
                AssessmentCaseParticipant.deleted_at.is_(None),
            )
            .distinct()
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    @typecheck
    async def list_by_participant_ids(
        self,
        participant_ids: list[str],
        center_id: uuid_str,
        participant_type: str | None = None,
        active_only: bool = True,
    ) -> list[AssessmentCaseParticipant]:
        if not participant_ids:
            return []
        conditions = [
            AssessmentCaseParticipant.participant_id.in_(participant_ids),
            AssessmentCaseParticipant.center_id == center_id,
        ]
        if active_only:
            conditions.append(AssessmentCaseParticipant.unassigned_at.is_(None))
        if participant_type:
            conditions.append(
                AssessmentCaseParticipant.participant_type == participant_type
            )
        return await self._filter(where=conditions)
