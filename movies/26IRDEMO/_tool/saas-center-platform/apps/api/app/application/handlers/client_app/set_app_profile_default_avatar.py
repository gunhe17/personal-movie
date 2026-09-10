from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.default_avatars import resolve_default_avatar_url
from app.modules.client_app.schemas import AppProfileImageRequest, AppProfileResponse
from app.modules.family.facade import FamilyFacade


async def set_app_profile_default_avatar_handler(
    *,
    person_id: uuid_str,
    profile_id: uuid_str,
    data: AppProfileImageRequest,
    uow: UnitOfWork,
) -> AppProfileResponse:
    async with uow:
        # verify
        url = resolve_default_avatar_url(data.default_avatar_key)
        if url is None:
            raise InvalidOperationException("고를 수 없는 기본 이미지예요")

        facade = FamilyFacade(uow)
        family_id = await facade.find_family_id(person_id=person_id)
        if family_id is None:
            raise EntityNotFoundException(f"프로필을 찾을 수 없습니다: {profile_id}")

        # 사진은 센터 연결 잠금(update_app_profile의 409) 밖이다 — 잠그는 이유가
        # 연결 매칭 키(이름·생년·성별)를 지키는 것이라 사진과 무관하다.
        profile = await facade.update_profile(
            profile_id=profile_id,
            family_id=family_id,
            image_url=url,
        )
        return AppProfileResponse.model_validate(profile)
