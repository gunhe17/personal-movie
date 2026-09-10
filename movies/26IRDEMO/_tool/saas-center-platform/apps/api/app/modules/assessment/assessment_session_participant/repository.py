from sqlalchemy import select

from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import AssessmentSessionParticipant


class AssessmentSessionParticipantRepository(PostgresRepository[AssessmentSessionParticipant]):
    model = AssessmentSessionParticipant

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        session_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
        attendance_status: str = "scheduled",
    ) -> AssessmentSessionParticipant:
        return await super().add(
            AssessmentSessionParticipant(
                center_id=center_id,
                session_id=session_id,
                participant_type=participant_type,
                participant_id=participant_id,
                attendance_status=attendance_status,
                attended_at=None,
            )
        )

    @typecheck
    async def add_or_restore(
        self,
        center_id: uuid_str,
        session_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
        attendance_status: str = "scheduled",
    ) -> AssessmentSessionParticipant:
        # soft-deleted 동일 참가자가 있으면 복원(재추가), 없으면 신규
        rows = await self._scalars(
            select(AssessmentSessionParticipant).where(
                AssessmentSessionParticipant.session_id == session_id,
                AssessmentSessionParticipant.participant_type == participant_type,
                AssessmentSessionParticipant.participant_id == participant_id,
                AssessmentSessionParticipant.deleted_at.is_not(None),
            )
        )
        if rows:
            rec = rows[0]
            rec.deleted_at = None
            rec.attendance_status = attendance_status
            rec.attended_at = None
            await self._session.flush()
            return rec
        return await self.add(
            center_id=center_id,
            session_id=session_id,
            participant_type=participant_type,
            participant_id=participant_id,
            attendance_status=attendance_status,
        )

    @typecheck
    async def remove_by_session(self, session_id: uuid_str) -> int:
        return await self.remove_where(
            where=[AssessmentSessionParticipant.session_id == session_id]
        )

    @typecheck
    async def remove_by_session_ids(self, session_ids: list[str]) -> int:
        if not session_ids:
            return 0
        return await self.remove_where(
            where=[AssessmentSessionParticipant.session_id.in_(session_ids)]
        )

    @typecheck
    async def update_attendance_to_scheduled(self, session_ids: list[str]) -> int:
        if not session_ids:
            return 0
        participants = await self.list_by_session_ids(session_ids=session_ids)
        if not participants:
            return 0
        count = 0
        for p in participants:
            if p.attendance_status != "scheduled":
                p.attendance_status = "scheduled"
                count += 1
        if count:
            await self._session.flush()
        return count


    # #
    # query

    @typecheck
    async def find_one(
        self,
        session_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> AssessmentSessionParticipant | None:
        return await self._find(
            where=[
                AssessmentSessionParticipant.session_id == session_id,
                AssessmentSessionParticipant.participant_type == participant_type,
                AssessmentSessionParticipant.participant_id == participant_id,
            ]
        )

    @typecheck
    async def get_one(
        self,
        session_id: uuid_str,
        participant_type: str,
        participant_id: uuid_str,
    ) -> AssessmentSessionParticipant:
        participant = await self.find_one(
            session_id=session_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )
        if participant is None:
            raise EntityNotFoundException(
                f"AssessmentSessionParticipant not found: {participant_id}"
            )
        return participant

    @typecheck
    async def list_by_session(
        self,
        session_id: uuid_str,
        participant_type: str | None = None,
    ) -> list[AssessmentSessionParticipant]:
        where = [
            AssessmentSessionParticipant.session_id == session_id,
            AssessmentSessionParticipant.deleted_at.is_(None),
        ]
        if participant_type:
            where.append(AssessmentSessionParticipant.participant_type == participant_type)
        stmt = (
            select(AssessmentSessionParticipant)
            .where(*where)
            .order_by(
                AssessmentSessionParticipant.participant_type,
                AssessmentSessionParticipant.created_at,
            )
        )
        return await self._scalars(stmt)

    @typecheck
    async def list_by_session_ids(self, session_ids: list[str]) -> list[AssessmentSessionParticipant]:
        if not session_ids:
            return []
        return await self._filter(where=[AssessmentSessionParticipant.session_id.in_(session_ids)])
