from app.core.exceptions import ConflictException
from ..repository import CounselingSessionParticipantRepository
from ..models import CounselingSessionParticipant
from ..events import SessionParticipantAtomic


class AddSessionParticipantsService:
    # Case에 없던 참여자도 세션에 직접 추가할 수 있다

    def __init__(self, repo: CounselingSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        session_id: str,
        *,
        client_ids: list[str] | None = None,
        counselor_ids: list[str] | None = None,
    ) -> tuple[list[SessionParticipantAtomic], list[CounselingSessionParticipant]]:
        atomics: list[SessionParticipantAtomic] = []
        added_participants: list[CounselingSessionParticipant] = []

        for participant_type, ids in (("client", client_ids), ("counselor", counselor_ids)):
            for participant_id in ids or []:
                participant = await self._add_or_restore(
                    center_id, session_id, participant_type, participant_id
                )
                atomic, participant = SessionParticipantAtomic.added(participant=participant)
                atomics.append(atomic)
                added_participants.append(participant)

        return atomics, added_participants

    async def _add_or_restore(
        self,
        center_id: str,
        session_id: str,
        participant_type: str,
        participant_id: str,
    ) -> CounselingSessionParticipant:
        # verify
        existing = await self.repo.find_by_session_and_participant(
            session_id=session_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )
        if existing:
            raise ConflictException(
                f"{participant_type.capitalize()} {participant_id} already exists in session {session_id}"
            )

        # soft delete된 레코드가 있으면 새로 만들지 않고 복원한다
        soft_deleted = await self.repo.find_by_session_and_participant_deleted_only(
            session_id=session_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )
        if soft_deleted:
            await self.repo.restore_by_id(soft_deleted.id)
            restored = await self.repo.update_in_place(
                soft_deleted.id,
                attendance_status="scheduled",
                attended_at=None,
            )
            assert restored is not None
            return restored

        return await self.repo.add(
            center_id=center_id,
            session_id=session_id,
            participant_type=participant_type,
            participant_id=participant_id,
            attendance_status="scheduled",
            attended_at=None,
        )
