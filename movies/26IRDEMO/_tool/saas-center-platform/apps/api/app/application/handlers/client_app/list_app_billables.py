from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade.billable_facade import BillableFacade
from app.modules.center.facade import CenterFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppBillableResponse
from app.modules.family.facade import FamilyFacade

# 보호자에게 보이면 안 되는 작성 중 상태 — 센터가 발행(issued)해야 청구가 성립한다
_HIDDEN_STATUSES = {"draft"}

_PAGE_SIZE = 50


async def list_app_billables_handler(
    *,
    person_id: uuid_str,
    uow: UnitOfWork,
) -> list[AppBillableResponse]:
    async with uow:
        family_id = await FamilyFacade(uow).find_family_id(person_id=person_id)
        if family_id is None:
            return []

        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family_id, alive_only=True
        )
        links = [link for link in links if link.status == "active"]
        if not links:
            return []

        profiles = await FamilyFacade(uow).list_profiles(family_id=family_id)
        profile_names = {profile.id: profile.display_name for profile in profiles}

        centers = await CenterFacade(uow).get_active_by_ids(
            list({link.center_id for link in links})
        )

        billable_facade = BillableFacade(uow)

        items: list[AppBillableResponse] = []
        for link in links:
            center = centers.get(link.center_id)
            listing, _ = await billable_facade.list_billables_with_response(
                center_id=link.center_id,
                client_id=link.client_id,
                page=1,
                size=_PAGE_SIZE,
            )
            for summary in listing.items:
                if summary.status.value in _HIDDEN_STATUSES:
                    continue
                items.append(
                    AppBillableResponse(
                        id=summary.id,
                        profile_id=link.profile_id,
                        profile_name=profile_names.get(link.profile_id),
                        center_id=link.center_id,
                        center_name=center.name if center else None,
                        billable_date=summary.billable_date,
                        due_date=summary.due_date,
                        status=summary.status.value,
                        total_amount=summary.total_amount,
                        discount_amount=summary.discount_amount,
                        subsidy_amount=summary.subsidy_amount,
                        paid_amount=summary.paid_amount,
                        unpaid_amount=summary.unpaid_amount,
                        item_summary=summary.item_summary,
                    )
                )

        items.sort(key=lambda item: item.billable_date, reverse=True)
        return items
