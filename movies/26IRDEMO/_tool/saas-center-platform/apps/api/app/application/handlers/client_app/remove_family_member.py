from app.core.exceptions import InvalidOperationException, PermissionDeniedException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.family.facade import FamilyFacade

OWNER_ROLE = "owner"


async def remove_family_member_handler(
    *,
    person_id: uuid_str,
    member_id: uuid_str,
    uow: UnitOfWork,
) -> None:
    async with uow:
        family_facade = FamilyFacade(uow)
        membership = await family_facade.find_membership(person_id=person_id)
        if membership is None or membership.role != OWNER_ROLE:
            raise PermissionDeniedException("가족 구성원은 관리자만 내보낼 수 있습니다")
        if membership.id == member_id:
            raise InvalidOperationException("관리자 본인은 내보낼 수 없습니다")

        members = await family_facade.list_members(family_id=membership.family_id)
        target = next((m for m in members if m.id == member_id), None)
        if target is None:
            raise InvalidOperationException("가족 구성원이 아닙니다")

        await family_facade.remove_member(member_id=member_id)
