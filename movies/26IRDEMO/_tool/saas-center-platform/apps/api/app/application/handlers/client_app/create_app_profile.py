from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.default_avatars import (
    pick_default_avatar_url,
    resolve_default_avatar_url,
)
from app.modules.client_app.schemas import AppProfileCreateRequest, AppProfileResponse
from app.modules.family.facade import FamilyFacade


async def create_app_profile_handler(
    *,
    person_id: uuid_str,
    data: AppProfileCreateRequest,
    uow: UnitOfWork,
) -> AppProfileResponse:
    async with uow:
        # 고른 게 있으면 그것, 없으면 성별 기준 랜덤 — 등록 화면에서 본 그림이 그대로 남는다
        if data.default_avatar_key is not None:
            image_url = resolve_default_avatar_url(data.default_avatar_key)
            if image_url is None:
                raise InvalidOperationException("고를 수 없는 기본 이미지예요")
        else:
            image_url = pick_default_avatar_url(data.gender)

        facade = FamilyFacade(uow)
        family = await facade.ensure_family(person_id=person_id)
        profile = await facade.create_profile(
            family_id=family.id,
            display_name=data.display_name,
            relation=data.relation,
            birth_date=data.birth_date,
            gender=data.gender,
            image_url=image_url,
        )
        return AppProfileResponse.model_validate(profile)
