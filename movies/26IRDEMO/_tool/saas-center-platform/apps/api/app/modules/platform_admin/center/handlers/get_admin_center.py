from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.center.repository import AdminCenterRepository
from app.modules.platform_admin.center.schemas import (
    AdminCenterDetailResponse,
    AdminCenterMember,
)
from app.modules.platform_admin.center.services.get_center import GetCenterService


async def get_admin_center_handler(
    center_id: str,
    uow: UnitOfWork,
) -> AdminCenterDetailResponse:
    repo = uow.repo(AdminCenterRepository)
    service = GetCenterService(repo)
    center, member_rows, email_map = await service.execute(center_id=center_id)

    members = [
        AdminCenterMember(
            id=member.id,
            account_id=person.account_id,
            name=person.name,
            email=email_map.get(person.id, ""),
            role_name=role.name,
            status=member.status,
        )
        for member, person, role in member_rows
    ]

    return AdminCenterDetailResponse(
        id=center.id,
        name=center.name,
        code=center.code,
        phone=center.phone,
        address=center.address,
        business_registration_number=center.business_registration_number,
        representative_name=center.representative_name,
        logo_url=center.logo_url,
        is_active=center.is_active,
        created_at=center.created_at,
        members=members,
    )


TOOL = {
    "name": "get_admin_center_handler",
    "permission": None,
    "purpose": "센터 상세를 운영자가 조회한다.",
    "keywords": ["어드민 센터 상세", "센터 관리 조회", "admin center 상세"],
    "boundaries": "운영자 전용 — 센터 기본 상세(멤버 포함, 읽기). 구독 탭은 get_center_subscription_tab_handler, 목록은 list_admin_centers_handler.",
    "output": "센터 상세 — 소속 멤버 포함 (AdminCenterDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "조회할 센터의 UUID.",
            },
        },
        "required": ["center_id"],
    },
}
