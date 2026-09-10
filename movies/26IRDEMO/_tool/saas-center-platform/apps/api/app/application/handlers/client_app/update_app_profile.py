from app.core.exceptions import ConflictException, EntityNotFoundException
from app.core.type import unset, uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppProfileUpdateRequest, AppProfileResponse
from app.modules.family.facade import FamilyFacade


async def update_app_profile_handler(
    *,
    person_id: uuid_str,
    profile_id: uuid_str,
    data: AppProfileUpdateRequest,
    uow: UnitOfWork,
) -> AppProfileResponse:
    async with uow:
        facade = FamilyFacade(uow)
        family_id = await facade.find_family_id(person_id=person_id)
        if family_id is None:
            raise EntityNotFoundException(f"프로필을 찾을 수 없습니다: {profile_id}")

        # 연결된 프로필은 센터 명부의 투영이라 앱에서 못 고친다 — 앱에서만 바꾸면
        # 센터와 갈라지고, 이름+생년월일+성별이 다음 연결의 대조 키라 매칭까지 깨진다.
        # 기록은 반대 방향(보호자 자산)이라 잠그지 않는다(설계.md §15-6-4 기각 박스).
        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family_id, alive_only=True
        )
        if any(link.profile_id == profile_id for link in links):
            raise ConflictException(
                "센터에 연결된 아이 정보는 센터에서 관리해요. 수정이 필요하면 센터에 알려 주세요"
            )

        provided = data.model_dump(exclude_unset=True)
        profile = await facade.update_profile(
            profile_id=profile_id,
            family_id=family_id,
            display_name=provided.get("display_name", unset),
            birth_date=provided.get("birth_date", unset),
            gender=provided.get("gender", unset),
        )
        return AppProfileResponse.model_validate(profile)
