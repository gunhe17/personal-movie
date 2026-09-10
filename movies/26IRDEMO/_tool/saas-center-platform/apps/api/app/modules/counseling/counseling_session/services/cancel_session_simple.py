from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from ..events import CounselingSessionAtomic
from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class CancelSessionSimpleService:
    # 존재 확인 외 상태전이 검증 없이 취소 — 복합 검증은 호출 handler가 소유

    def __init__(self, session_repo: CounselingSessionRepository):
        self.session_repo = session_repo

    async def execute(
        self,
        session_id: str,
        center_id: str,
        cancel_reason: str | None = None,
    ) -> tuple[CounselingSessionAtomic, CounselingSession]:
        # load
        await self.session_repo.get_in_center(
            session_id=session_id,
            center_id=center_id,
        )

        # cancel
        updated = await self.session_repo.update_in_center(
            session_id=session_id,
            center_id=center_id,
            status=CounselingSessionStatus.CANCELLED,
            cancel_reason=cancel_reason,
        )
        assert updated is not None
        return CounselingSessionAtomic.cancelled(session=updated)
