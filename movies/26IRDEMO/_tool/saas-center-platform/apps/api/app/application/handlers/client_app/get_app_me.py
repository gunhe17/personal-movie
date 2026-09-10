from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.facade import AuthFacade
from app.modules.center.facade import CenterFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import (
    AppAccountSummary,
    AppFamilySummary,
    AppLinkResponse,
    AppMeResponse,
    AppPersonSummary,
    AppProfileResponse,
)
from app.modules.client.facade import ClientFacade
from app.modules.family.facade import FamilyFacade
from app.modules.person.facade import PersonFacade


async def get_app_me_handler(
    *,
    account_id: uuid_str,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> AppMeResponse:
    async with uow:
        account = await AuthFacade(uow).get_account(account_id)
        person = await PersonFacade(uow).find_person_by_account(account_id)

        family_facade = FamilyFacade(uow)
        family = await family_facade.ensure_family(person_id=person_id)
        profiles = await family_facade.list_profiles(family_id=family.id)

        links = await CenterLinkFacade(uow).list_links_by_family(family_id=family.id)
        # 프로필 병합으로 옮겨간 옛 링크는 표면에서 지운다 — 남기면 같은 센터가
        # "지난 연결"과 활성으로 두 번 보인다(정정은 감사에만 남는다)
        links = [link for link in links if link.end_reason != "mismap"]
        centers = await CenterFacade(uow).get_active_by_ids(
            list({link.center_id for link in links})
        )
        link_responses = [
            AppLinkResponse(
                id=link.id,
                profile_id=link.profile_id,
                center_id=link.center_id,
                center_name=centers[link.center_id].name if link.center_id in centers else None,
                center_phone=centers[link.center_id].phone if link.center_id in centers else None,
                center_logo_url=centers[link.center_id].logo_url if link.center_id in centers else None,
                client_id=link.client_id,
                status=link.status,
                linked_at=link.linked_at,
            )
            for link in links
        ]

        # 보호자가 고른 사진이 없을 때의 대체 = 연결된 Client의 profile_image_url.
        # Profile↔Client는 N:1(센터별)이라 활성 링크 중 이미지가 있는 첫 Client 것을 쓴다.
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

        linked_profile_ids = {link.profile_id for link in active_links}
        profile_responses = []
        for profile in profiles:
            response = AppProfileResponse.model_validate(profile)
            response.image_url = profile.image_url or image_by_profile.get(profile.id)
            response.is_linked = profile.id in linked_profile_ids
            profile_responses.append(response)

        return AppMeResponse(
            account=AppAccountSummary.model_validate(account),
            person=AppPersonSummary.model_validate(person),
            family=AppFamilySummary.model_validate(family),
            profiles=profile_responses,
            links=link_responses,
        )
