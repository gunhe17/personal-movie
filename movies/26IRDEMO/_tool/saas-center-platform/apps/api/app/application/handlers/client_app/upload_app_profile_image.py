from fastapi import UploadFile

from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppProfileResponse
from app.modules.family.facade import FamilyFacade
from app.modules.upload.image.handlers import upload_image_handler
from app.modules.upload.image.schemas import ImageCategory


async def upload_app_profile_image_handler(
    *,
    person_id: uuid_str,
    profile_id: uuid_str,
    file: UploadFile,
    uow: UnitOfWork,
) -> AppProfileResponse:
    async with uow:
        facade = FamilyFacade(uow)
        family_id = await facade.find_family_id(person_id=person_id)
        if family_id is None:
            raise EntityNotFoundException(f"프로필을 찾을 수 없습니다: {profile_id}")
        # 스토리지에 올리기 전에 내 가족의 프로필인지부터 — 남의 id로 namespace를 쓰는 걸 막는다
        await facade.get_profile(profile_id=profile_id, family_id=family_id)

        uploaded = await upload_image_handler(
            file, ImageCategory.PROFILE_AVATAR, profile_id
        )

        profile = await facade.update_profile(
            profile_id=profile_id,
            family_id=family_id,
            image_url=uploaded.url,
        )
        return AppProfileResponse.model_validate(profile)
