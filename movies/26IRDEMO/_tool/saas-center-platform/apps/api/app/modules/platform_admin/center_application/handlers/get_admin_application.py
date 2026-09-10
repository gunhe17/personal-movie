from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.center_application.repository import (
    AdminApplicationRepository,
)
from app.modules.platform_admin.center_application.schemas import (
    AdminApplicationDetailResponse,
)
from app.modules.platform_admin.center_application.services.get_application import (
    GetApplicationService,
)


async def get_admin_application_handler(
    application_id: str,
    uow: UnitOfWork,
) -> AdminApplicationDetailResponse:
    repo = uow.repo(AdminApplicationRepository)
    service = GetApplicationService(repo)
    app, person_name, account_email = await service.execute(
        application_id=application_id
    )

    return AdminApplicationDetailResponse(
        id=app.id,
        center_name=app.name,
        applicant_name=person_name,
        applicant_email=account_email,
        phone=app.phone,
        address=app.address,
        description=app.description,
        business_registration_number=app.business_registration_number,
        representative_name=app.representative_name,
        status=app.status.lower(),
        created_at=app.created_at,
        reviewed_at=app.reviewed_at,
        reviewed_by=app.reviewed_by,
        reviewed_reason=app.reviewed_reason,
        center_id=app.center_id,
        updated_at=app.updated_at,
    )


TOOL = {
    "name": "get_admin_application_handler",
    "permission": None,
    "purpose": "센터 개설 신청 상세를 운영자가 조회한다.",
    "keywords": ["센터 신청 상세", "개설 신청 조회", "admin application 상세"],
    "boundaries": "운영자 전용 — 센터 개설 신청 상세(읽기). 목록은 list_admin_applications_handler, 승인/반려는 approve·reject_admin_application_handler.",
    "output": "센터 개설 신청 상세 (AdminApplicationDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "application_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 신청",
                "description": "조회할 센터 개설 신청의 UUID.",
            },
        },
        "required": ["application_id"],
    },
}
