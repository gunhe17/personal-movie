from ..models import CenterApplicationStatus
from app.core.exceptions import InvalidOperationException

from ..events import CenterApplicationAtomic
from ..models import CenterApplication
from ..repository import CenterApplicationRepository


class CancelApplicationService:
    def __init__(self, repo: CenterApplicationRepository):
        self.repo = repo

    async def execute(
        self,
        application_id: str,
        account_id: str,
    ) -> tuple[CenterApplicationAtomic, CenterApplication]:
        # load
        application = await self.repo.get_by_account(application_id, account_id=account_id)

        # verify
        if application.status != CenterApplicationStatus.PENDING:
            raise InvalidOperationException("대기 중인 신청만 취소할 수 있습니다")

        # remove (soft)
        removed = await self.repo.remove_by_id(application_id)
        return CenterApplicationAtomic.cancelled(application=removed or application)
