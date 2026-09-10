from datetime import date

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppClientVoucherItem
from app.modules.family.facade import FamilyFacade
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade

_PAGE_SIZE = 50


async def list_app_client_vouchers_handler(
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> list[AppClientVoucherItem]:
    family_facade = FamilyFacade(uow)
    family_id = await family_facade.find_family_id(person_id=person_id)
    if family_id is None:
        return []

    links = await CenterLinkFacade(uow).list_links_by_family(
        family_id=family_id, alive_only=True
    )
    links = [link for link in links if link.status == "active"]
    if not links:
        return []

    profiles = await family_facade.list_profiles(family_id=family_id)
    profile_names = {profile.id: profile.display_name for profile in profiles}

    centers = await CenterFacade(uow).get_active_by_ids(
        list({link.center_id for link in links})
    )

    client_voucher_facade = ClientVoucherFacade(uow)

    items: list[AppClientVoucherItem] = []
    for link in links:
        center = centers.get(link.center_id)
        listing = await client_voucher_facade.list_client_vouchers_with_response(
            center_id=link.center_id,
            client_id=link.client_id,
            page=1,
            size=_PAGE_SIZE,
        )
        for voucher in listing.items:
            catalog = voucher.catalog
            items.append(
                AppClientVoucherItem(
                    id=voucher.id,
                    profile_id=link.profile_id,
                    profile_name=profile_names.get(link.profile_id),
                    center_id=link.center_id,
                    center_name=center.name if center else None,
                    name=catalog.name if catalog else None,
                    program_organization=(
                        catalog.program_organization if catalog else None
                    ),
                    total_sessions=voucher.total_sessions,
                    remaining_sessions=voucher.remaining_sessions,
                    valid_from=voucher.valid_from,
                    valid_until=voucher.valid_until,
                )
            )

    items.sort(key=lambda item: item.valid_until or date.max)
    return items
