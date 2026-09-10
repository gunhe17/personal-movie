from ..models import CenterApplicationStatus
from app.core.exceptions import InvalidOperationException

from ..events import CenterApplicationAtomic
from ..models import CenterApplication
from ..repository import CenterApplicationRepository


class CreateApplicationService:
    def __init__(self, repo: CenterApplicationRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        name: str,
        phone: str | None,
        address: dict | None,
        description: str | None,
        business_registration_number: str | None,
        representative_name: str | None,
    ) -> tuple[CenterApplicationAtomic, CenterApplication]:
        # verify
        if await self.repo.exists_pending_by_account(account_id=account_id):
            raise InvalidOperationException("이미 대기 중인 센터 등록 신청이 있습니다")

        # return
        application = await self.repo.add(
            created_by=account_id,
            name=name,
            phone=phone,
            address=address,
            description=description,
            business_registration_number=business_registration_number,
            representative_name=representative_name,
            status=CenterApplicationStatus.PENDING,
        )
        return CenterApplicationAtomic.created(application=application)
