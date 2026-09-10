from app.core.type import unset
from ..events import SessionParticipantAtomic
from ..repository import CounselingSessionParticipantRepository
from ..models import CounselingSessionParticipant
from .update_participant_by_id import UpdateParticipantByIdService


class UpdateAttendanceService:
    def __init__(self, repo: CounselingSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        session_id: str,
        participant_type: str,
        participant_id: str,
        attendance_status: str = unset,
        is_consumed: bool = unset,
        memo: str | None = unset,
        changed: dict | None = None,
    ) -> tuple[SessionParticipantAtomic, CounselingSessionParticipant]:
        # load
        participant = await self.repo.get_by_session_and_participant(
            session_id=session_id,
            participant_type=participant_type,
            participant_id=participant_id,
        )

        # return
        fields = {
            "attendance_status": attendance_status,
            "is_consumed": is_consumed,
            "memo": memo,
        }
        return await UpdateParticipantByIdService(self.repo).execute(
            session_participant_id=participant.id,
            center_id=participant.center_id,
            changed=changed
            if changed is not None
            else {key: value for key, value in fields.items() if value is not unset},
            **fields,
        )
