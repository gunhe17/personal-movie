from app.core.datetime_utils import utc_now
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.client_app.schemas import (
    AppInvitationResponse,
    AppLinkStatusResponse,
    AppLinkedChildSummary,
)


async def get_app_link_status_handler(
    *,
    center_id: uuid_str,
    client_id: uuid_str,
    uow: UnitOfWork,
) -> AppLinkStatusResponse:
    now = utc_now()

    async with uow:
        link_facade = CenterLinkFacade(uow)

        links = await link_facade.list_links_by_guardian(
            center_id=center_id, guardian_client_id=client_id
        )
        active_links = [link for link in links if link.status == "active"]

        invitations = await link_facade.list_valid_invitations(
            center_id=center_id, guardian_client_id=client_id, now=now
        )

        if active_links:
            status = "linked"
        elif invitations:
            status = "invited"
        else:
            status = "none"

        children = await ClientFacade(uow).get_clients_by_ids(
            [link.client_id for link in active_links]
        )

        return AppLinkStatusResponse(
            status=status,
            invitation=(
                AppInvitationResponse.model_validate(invitations[0])
                if invitations
                else None
            ),
            linked_children=[
                AppLinkedChildSummary(
                    client_id=link.client_id,
                    name=children[link.client_id].name if link.client_id in children else None,
                    linked_at=link.linked_at,
                )
                for link in active_links
            ],
        )
