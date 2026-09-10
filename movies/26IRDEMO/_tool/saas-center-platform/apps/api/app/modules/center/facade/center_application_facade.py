from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..center_application.repository import CenterApplicationRepository
from ..center_application.services import (
    CreateApplicationService,
    GetApplicationService,
    ApproveApplicationService,
    RejectApplicationService,
    CancelApplicationService,
    ListApplicationsService,
    ListApplicationsByPersonService,
)
from ..center_application.events import CenterApplicationAtomic
from ..center_application.schemas import (
    CenterApplicationResponse,
    CenterApplicationSummary,
    CenterApplicationListResponse,
)
from ..center_application.models import CenterApplication
from ..center.events import CenterAtomic
from ..center.repository import CenterRepository
from ..center.services import CreateCenterService
from ..center.schemas import CenterCreate, AddressInfo


class CenterApplicationFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def approve_application(
        self,
        application_id: str,
        reviewer_account_id: str,
    ) -> tuple[list[CenterAtomic | CenterApplicationAtomic], CenterApplication]:
        # AdminMember 생성은 Application Handler에서 처리 (센터별 Role 초기화 후 생성해야 함).
        application_repo = self._uow.repo(CenterApplicationRepository)
        center_repo = self._uow.repo(CenterRepository)

        get_service = GetApplicationService(application_repo)
        application = await get_service.execute(application_id)

        create_center_service = CreateCenterService(center_repo)
        center_data = CenterCreate(
            name=application.name,
            phone=application.phone,
            address=AddressInfo.model_validate(application.address)
            if application.address
            else None,
            description=application.description,
            business_registration_number=application.business_registration_number,
            representative_name=application.representative_name,
        )
        center_atomic, center = await create_center_service.execute(
            name=center_data.name,
            phone=center_data.phone,
            address=center_data.address.model_dump() if center_data.address else None,
            description=center_data.description,
            logo_url=center_data.logo_url,
            business_registration_number=center_data.business_registration_number,
            representative_name=center_data.representative_name,
        )

        approve_service = ApproveApplicationService(application_repo)
        approve_atomic, application = await approve_service.execute(
            application_id,
            center.id,
            reviewer_account_id,
        )
        return [center_atomic, approve_atomic], application

    async def list_applications_by_account(
        self,
        account_id: str,
    ) -> list[CenterApplication]:
        application_repo = self._uow.repo(CenterApplicationRepository)
        service = ListApplicationsByPersonService(application_repo)
        return await service.execute(account_id)

    async def create_application_with_response(
        self,
        account_id: str,
        name: str,
        phone: str | None,
        address: dict | None,
        description: str | None,
        business_registration_number: str | None,
        representative_name: str | None,
    ) -> tuple[CenterApplicationAtomic, CenterApplicationResponse]:
        repo = self._uow.repo(CenterApplicationRepository)
        service = CreateApplicationService(repo)
        atomic, application = await service.execute(
            account_id=account_id,
            name=name,
            phone=phone,
            address=address,
            description=description,
            business_registration_number=business_registration_number,
            representative_name=representative_name,
        )
        return atomic, CenterApplicationResponse.model_validate(application)

    async def get_application_with_response(
        self,
        application_id: str,
    ) -> CenterApplicationResponse:
        repo = self._uow.repo(CenterApplicationRepository)
        service = GetApplicationService(repo)
        application = await service.execute(application_id)
        return CenterApplicationResponse.model_validate(application)

    async def list_applications_with_response(
        self,
        status_filter: str | None,
        skip: int,
        limit: int,
    ) -> CenterApplicationListResponse:
        repo = self._uow.repo(CenterApplicationRepository)
        service = ListApplicationsService(repo)
        applications, total = await service.execute(status_filter, skip, limit)
        return CenterApplicationListResponse(
            items=[CenterApplicationSummary.model_validate(a) for a in applications],
            total=total,
            page=skip // limit + 1 if limit > 0 else 1,
            size=limit,
            pages=(total + limit - 1) // limit if limit > 0 else 1,
        )

    async def reject_application(
        self,
        application_id: str,
        reviewed_reason: str | None,
        reviewer_account_id: str,
    ) -> tuple[CenterApplicationAtomic, CenterApplication]:
        repo = self._uow.repo(CenterApplicationRepository)
        service = RejectApplicationService(repo)
        return await service.execute(
            application_id=application_id,
            reviewed_reason=reviewed_reason,
            reviewer_account_id=reviewer_account_id,
        )

    async def reject_application_with_response(
        self,
        application_id: str,
        reviewed_reason: str | None,
        reviewer_account_id: str,
    ) -> tuple[CenterApplicationAtomic, CenterApplicationResponse]:
        atomic, application = await self.reject_application(
            application_id=application_id,
            reviewed_reason=reviewed_reason,
            reviewer_account_id=reviewer_account_id,
        )
        return atomic, CenterApplicationResponse.model_validate(application)

    async def cancel_application_with_response(
        self,
        application_id: str,
        account_id: str,
    ) -> tuple[CenterApplicationAtomic, CenterApplicationResponse]:
        repo = self._uow.repo(CenterApplicationRepository)
        service = CancelApplicationService(repo)
        atomic, application = await service.execute(application_id, account_id)
        return atomic, CenterApplicationResponse.model_validate(application)
