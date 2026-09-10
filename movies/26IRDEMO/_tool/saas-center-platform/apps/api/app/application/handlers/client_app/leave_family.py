from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.family.facade import FamilyFacade

OWNER_ROLE = "owner"


async def leave_family_handler(
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> None:
    async with uow:
        family_facade = FamilyFacade(uow)
        membership = await family_facade.find_membership(person_id=person_id)
        if membership is None:
            raise InvalidOperationException("속한 가족이 없습니다")

        # 관리자가 나가면 프로필·센터 연결이 주인 없이 남는다. 이양 기능이 생기기 전까지 차단.
        if membership.role == OWNER_ROLE:
            members = await family_facade.list_members(family_id=membership.family_id)
            if len(members) > 1:
                raise InvalidOperationException(
                    "관리자는 가족에서 나갈 수 없습니다. 다른 구성원을 먼저 내보내 주세요."
                )
            raise InvalidOperationException("혼자 있는 가족에서는 나갈 수 없습니다")

        await family_facade.remove_member(member_id=membership.id)
