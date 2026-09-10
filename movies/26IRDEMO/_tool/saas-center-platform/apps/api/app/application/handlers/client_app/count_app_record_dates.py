from datetime import datetime

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppRecordDateCountResponse
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade

SELF_RELATION = "self"


async def count_app_record_dates_handler(
    *,
    person_id: uuid_str,
    profile_id: str | None,
    occurred_from: datetime,
    occurred_to: datetime,
    uow: UnitOfWork,
) -> AppRecordDateCountResponse:
    membership = await FamilyFacade(uow).find_membership(person_id=person_id)
    if membership is None:
        return AppRecordDateCountResponse(counts={})

    profiles = await FamilyFacade(uow).list_profiles(family_id=membership.family_id)
    if profile_id is not None:
        profiles = [p for p in profiles if p.id == profile_id]

    counts = await LedgerFacade(uow).count_entries_by_date(
        person_id=person_id,
        shared_profile_ids=[p.id for p in profiles if p.relation != SELF_RELATION],
        private_profile_ids=[p.id for p in profiles if p.relation == SELF_RELATION],
        occurred_from=occurred_from,
        occurred_to=occurred_to,
    )

    # return
    return AppRecordDateCountResponse(counts=counts)
