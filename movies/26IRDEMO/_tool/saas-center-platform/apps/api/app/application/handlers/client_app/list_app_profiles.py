from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client.facade import ClientFacade
from app.modules.client_app.schemas import AppProfileResponse
from app.modules.family.facade import FamilyFacade


async def list_app_profiles_handler(
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> list[AppProfileResponse]:
    async with uow:
        facade = FamilyFacade(uow)
        family = await facade.ensure_family(person_id=person_id)
        profiles = await facade.list_profiles(family_id=family.id)

        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family.id, alive_only=True
        )
        linked_profile_ids = {link.profile_id for link in links}

        # 보호자가 고른 사진이 없을 때의 대체 = 연결된 Client의 사진 (get_app_me와 같은 규칙)
        active_links = [link for link in links if link.status == "active"]
        client_infos = await ClientFacade(uow).get_clients_by_ids(
            [link.client_id for link in active_links]
        )
        image_by_profile: dict[str, str] = {}
        for link in active_links:
            if link.profile_id in image_by_profile:
                continue
            info = client_infos.get(link.client_id)
            if info and info.profile_image_url:
                image_by_profile[link.profile_id] = info.profile_image_url

        responses = []
        for profile in profiles:
            response = AppProfileResponse.model_validate(profile)
            response.image_url = profile.image_url or image_by_profile.get(profile.id)
            response.is_linked = profile.id in linked_profile_ids
            responses.append(response)
        return responses
