from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade.billable_facade import BillableFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import (
    AppBillableDetailResponse,
    AppBillableItem,
)
from app.modules.family.facade import FamilyFacade

_HIDDEN_STATUSES = {"draft"}


async def get_app_billable_detail_handler(
    *,
    person_id: uuid_str,
    billable_id: uuid_str,
    center_id: uuid_str,
    uow: UnitOfWork,
) -> AppBillableDetailResponse:
    async with uow:
        family_id = await FamilyFacade(uow).find_family_id(person_id=person_id)
        if family_id is None:
            raise EntityNotFoundException("청구서를 찾을 수 없습니다")

        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family_id, alive_only=True
        )
        client_ids = {
            link.client_id
            for link in links
            if link.status == "active" and link.center_id == center_id
        }
        if not client_ids:
            raise EntityNotFoundException("청구서를 찾을 수 없습니다")

        detail = await BillableFacade(uow).get_billable_with_response(
            center_id=center_id,
            billable_id=billable_id,
        )
        # 우리 가족의 내담자 청구서가 아니거나 작성 중이면 노출하지 않는다
        if detail.client_id not in client_ids or detail.status.value in _HIDDEN_STATUSES:
            raise EntityNotFoundException("청구서를 찾을 수 없습니다")

        return AppBillableDetailResponse(
            id=detail.id,
            status=detail.status.value,
            billable_date=detail.billable_date,
            issued_at=detail.issued_at,
            total_amount=detail.total_amount,
            discount_amount=detail.discount_amount,
            subsidy_amount=detail.subsidy_amount,
            paid_amount=detail.paid_amount,
            unpaid_amount=detail.unpaid_amount,
            memo=detail.memo,
            items=[
                AppBillableItem(
                    id=item.id,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    amount=item.amount,
                    related_type=item.related_type,
                )
                for item in detail.items
            ],
        )
