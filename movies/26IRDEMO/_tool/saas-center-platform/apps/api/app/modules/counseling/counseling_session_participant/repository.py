from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy import func, update as sql_update

from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CounselingSessionParticipant
from ..counseling_session.models import CounselingSession
from .models import ParticipantType


class CounselingSessionParticipantRepository(
    PostgresRepository[CounselingSessionParticipant]
):
    model = CounselingSessionParticipant

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        session_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
        attendance_status: str,
        is_consumed: bool = False,
        attended_at: datetime | None = None,
        memo: str | None = None,
    ) -> CounselingSessionParticipant:
        return await super().add(
            CounselingSessionParticipant(
                center_id=center_id,
                session_id=session_id,
                participant_type=participant_type,
                participant_id=participant_id,
                attendance_status=attendance_status,
                is_consumed=is_consumed,
                attended_at=attended_at,
                memo=memo,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        session_participant_id: uuid_str,
        *,
        attendance_status: str = unset,
        is_consumed: bool = unset,
        attended_at: utc_dt | None = unset,
        memo: str | None = unset,
    ) -> CounselingSessionParticipant | None:
        return await self.update_fields(
            session_participant_id,
            attendance_status=attendance_status,
            is_consumed=is_consumed,
            attended_at=attended_at,
            memo=memo,
        )

    @typecheck
    async def remove_by_session(self, session_id: uuid_str) -> int:
        return await self.remove_where(
            where=[CounselingSessionParticipant.session_id == session_id]
        )

    @typecheck
    async def remove_by_session_and_type(
        self,
        session_id: uuid_str,
        participant_type: str,
    ) -> list[CounselingSessionParticipant]:
        stmt = (
            sql_update(CounselingSessionParticipant)
            .where(
                CounselingSessionParticipant.deleted_at.is_(None),
                CounselingSessionParticipant.session_id == session_id,
                CounselingSessionParticipant.participant_type == participant_type,
            )
            .values(deleted_at=func.now())
            .returning(CounselingSessionParticipant)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    # #
    # query

    @typecheck
    async def get_in_center(
        self,
        id: uuid_str,
        center_id: uuid_str,
    ) -> CounselingSessionParticipant:
        found = await self._find(
            where=[
                CounselingSessionParticipant.id == id,
                CounselingSessionParticipant.center_id == center_id,
            ],
        )
        if found is None:
            raise EntityNotFoundException(f"SessionParticipant not found: {id}")
        return found

    @typecheck
    async def find_by_session_and_participant(
        self,
        session_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> CounselingSessionParticipant | None:
        return await self._find(
            where=[
                CounselingSessionParticipant.session_id == session_id,
                CounselingSessionParticipant.participant_type == participant_type,
                CounselingSessionParticipant.participant_id == participant_id,
            ]
        )

    @typecheck
    async def get_by_session_and_participant(
        self,
        session_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> CounselingSessionParticipant:
        participant = await self.find_by_session_and_participant(
            session_id=session_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )
        if participant is None:
            raise EntityNotFoundException(
                f"Participant not found: session={session_id}, "
                f"type={participant_type}, id={participant_id}"
            )
        return participant

    @typecheck
    async def find_by_session_and_participant_deleted_only(
        self,
        session_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> CounselingSessionParticipant | None:
        stmt = select(CounselingSessionParticipant).where(
            and_(
                CounselingSessionParticipant.session_id == session_id,
                CounselingSessionParticipant.participant_type == participant_type,
                CounselingSessionParticipant.participant_id == participant_id,
                CounselingSessionParticipant.deleted_at.isnot(None),
            )
        )
        rows = await self._scalars(stmt)
        return rows[0] if rows else None

    @typecheck
    async def list_by_session(
        self,
        session_id: uuid_str,
        participant_type: str | None = None,
    ) -> list[CounselingSessionParticipant]:
        where = [CounselingSessionParticipant.session_id == session_id]
        if participant_type:
            where.append(
                CounselingSessionParticipant.participant_type == participant_type
            )

        stmt = (
            select(CounselingSessionParticipant)
            .where(CounselingSessionParticipant.deleted_at.is_(None), *where)
            .order_by(
                CounselingSessionParticipant.participant_type,
                CounselingSessionParticipant.created_at,
            )
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_by_session_ids(
        self,
        session_ids: list[str],
    ) -> list[CounselingSessionParticipant]:
        if not session_ids:
            return []

        return await self._filter(
            where=[CounselingSessionParticipant.session_id.in_(session_ids)]
        )

    @typecheck
    async def aggregate_recent_attendance_for_client(
        self,
        client_id: uuid_str,
        center_id: uuid_str,
        *,
        limit: int,
    ) -> list[tuple[str, datetime | None, str]]:
        stmt = (
            select(
                CounselingSessionParticipant.attendance_status,
                CounselingSession.completed_at,
                CounselingSession.created_at,
                CounselingSession.id.label("session_id"),
            )
            .join(
                CounselingSession,
                CounselingSession.id == CounselingSessionParticipant.session_id,
            )
            .where(
                CounselingSessionParticipant.center_id == center_id,
                CounselingSessionParticipant.participant_id == client_id,
                CounselingSessionParticipant.participant_type
                == ParticipantType.CLIENT.value,
                CounselingSessionParticipant.deleted_at.is_(None),
                CounselingSession.deleted_at.is_(None),
                CounselingSession.status.in_(("completed", "no_show")),
            )
            .order_by(
                CounselingSession.completed_at.desc().nullslast(),
                CounselingSession.created_at.desc(),
            )
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [
            (row.attendance_status, row.completed_at or row.created_at, row.session_id)
            for row in result.all()
        ]
