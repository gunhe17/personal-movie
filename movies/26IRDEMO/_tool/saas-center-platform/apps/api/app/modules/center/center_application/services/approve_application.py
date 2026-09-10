from ..models import CenterApplicationStatus
from app.core.datetime_utils import utc_now
from app.core.exceptions import (
    InvalidOperationException,
)

from ..events import CenterApplicationAtomic
from ..models import CenterApplication
from ..repository import CenterApplicationRepository


class ApproveApplicationService:
    def __init__(self, repo: CenterApplicationRepository):
        self.repo = repo

    async def execute(
        self,
        application_id: str,
        center_id: str,
        reviewer_account_id: str,
    ) -> tuple[CenterApplicationAtomic, CenterApplication]:
        # load
        application = await self.repo.get_by_id(application_id)

        # verify
        if application.status != CenterApplicationStatus.PENDING:
            raise InvalidOperationException("대기 중인 신청만 승인할 수 있습니다")

        # update
        updated_application = await self.repo.update_in_place(
            application_id,
            status=CenterApplicationStatus.APPROVED,
            reviewed_at=utc_now(),
            reviewed_by=reviewer_account_id,
            center_id=center_id,
        )
        if not updated_application:
            raise InvalidOperationException("신청 승인에 실패했습니다")

        # return
        return CenterApplicationAtomic.approved(application=updated_application)
