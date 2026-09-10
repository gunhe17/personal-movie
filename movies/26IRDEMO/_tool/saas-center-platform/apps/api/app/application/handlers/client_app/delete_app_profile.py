from app.core.exceptions import (
    ConflictException,
    EntityNotFoundException,
    PermissionDeniedException,
)
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.family.facade import FamilyFacade


async def delete_app_profile_handler(
    *,
    person_id: uuid_str,
    profile_id: uuid_str,
    uow: UnitOfWork,
) -> None:
    async with uow:
        facade = FamilyFacade(uow)
        # 가족 데이터를 되돌릴 수 없게 바꾸는 동작은 관리자(owner)만 — 구성원은 열람·수정까지
        membership = await facade.find_membership(person_id=person_id)
        if membership is None:
            raise EntityNotFoundException("가족을 찾을 수 없습니다")
        if membership.role != "owner":
            raise PermissionDeniedException("아이 프로필 삭제는 관리자만 할 수 있습니다")
        family_id = membership.family_id

        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family_id, alive_only=True
        )
        if any(link.profile_id == profile_id for link in links):
            raise ConflictException("센터에 연결된 프로필은 삭제할 수 없습니다")

        await facade.remove_profile(profile_id=profile_id, family_id=family_id)
