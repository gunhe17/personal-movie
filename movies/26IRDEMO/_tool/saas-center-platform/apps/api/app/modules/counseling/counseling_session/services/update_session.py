from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.core.type import unset
from ..events import CounselingSessionAtomic
from ..repository import CounselingSessionRepository
from ..models import CounselingSession
from app.core.datetime_utils import utc_now


class UpdateSessionService:
    def __init__(self, session_repo: CounselingSessionRepository):
        self.session_repo = session_repo

    async def execute(
        self,
        *,
        session_id: str,
        center_id: str,
        changed: dict,
        status: str | None = None,
    ) -> tuple[CounselingSessionAtomic, CounselingSession]:
        # load
        session = await self.session_repo.get_in_center(
            session_id=session_id,
            center_id=center_id,
        )

        # compute
        new_status = status if status is not None else unset

        completed_at = unset
        if status == CounselingSessionStatus.COMPLETED and not session.completed_at:
            completed_at = utc_now()

        # update
        updated = await self.session_repo.update_in_center(
            session_id=session_id,
            center_id=center_id,
            status=new_status,
            completed_at=completed_at,
        )
        assert updated is not None
        return CounselingSessionAtomic.updated(session=updated, changed=changed)
