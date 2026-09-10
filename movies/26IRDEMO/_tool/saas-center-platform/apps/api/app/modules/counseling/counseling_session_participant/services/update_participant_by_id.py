from app.core.exceptions import InvalidOperationException
from app.core.type import unset
from ..events import SessionParticipantAtomic
from ..repository import CounselingSessionParticipantRepository
from ..models import CounselingSessionParticipant
from app.core.datetime_utils import utc_now


class UpdateParticipantByIdService:
    def __init__(self, repo: CounselingSessionParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        session_participant_id: str,
        center_id: str,
        changed: dict,
        attendance_status: str = unset,
        is_consumed: bool = unset,
        memo: str | None = unset,
    ) -> tuple[SessionParticipantAtomic, CounselingSessionParticipant]:
        # load
        await self.repo.get_in_center(
            id=session_participant_id,
            center_id=center_id,
        )

        # verify + compute
        new_status = unset
        new_attended_at = unset
        if attendance_status is not unset:
            # scheduled(미확정) 포함 — 회기를 '예정'으로 되돌리면 출결도 미확정으로 돌아가야 한다.
            # 출결은 '진행된 회기'에만 성립하므로 예정 회기에 확정 출결이 남으면 모순이다.
            valid_statuses = [
                "scheduled",
                "attended",
                "absent",
                "late",
                "excused",
                "no_show",
            ]
            if attendance_status not in valid_statuses:
                raise InvalidOperationException(
                    f"Invalid attendance status: {attendance_status}. "
                    f"Use one of: {', '.join(valid_statuses)}"
                )

            new_status = attendance_status
            new_attended_at = (
                utc_now() if attendance_status in ["attended", "late"] else None
            )

        updated = await self.repo.update_in_place(
            session_participant_id=session_participant_id,
            attendance_status=new_status,
            attended_at=new_attended_at,
            is_consumed=is_consumed,
            memo=memo,
        )
        assert updated is not None
        return SessionParticipantAtomic.updated(participant=updated, changed=changed)
