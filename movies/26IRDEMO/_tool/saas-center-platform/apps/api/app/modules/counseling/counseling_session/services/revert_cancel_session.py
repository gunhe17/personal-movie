from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.core.exceptions import InvalidOperationException
from ..repository import CounselingSessionRepository
from ..models import CounselingSession
from ..events import CounselingSessionAtomic


class RevertCancelSessionService:
    def __init__(self, session_repo: CounselingSessionRepository):
        self.session_repo = session_repo

    async def execute(
        self,
        session_id: str,
        center_id: str,
    ) -> tuple[CounselingSessionAtomic, CounselingSession]:
        session = await self.session_repo.get_in_center(
            session_id=session_id,
            center_id=center_id,
        )
        if session.status != CounselingSessionStatus.CANCELLED:
            raise InvalidOperationException("취소된 세션만 되돌릴 수 있습니다")
        updated = await self.session_repo.update_in_center(
            session_id=session_id,
            center_id=center_id,
            status=CounselingSessionStatus.SCHEDULED,
            cancel_reason=None,
        )
        assert updated is not None
        return CounselingSessionAtomic.reverted(session=updated)
