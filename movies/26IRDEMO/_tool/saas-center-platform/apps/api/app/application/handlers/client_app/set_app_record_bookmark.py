from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppRecordBookmarkRequest, AppRecordResponse
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade

SELF_RELATION = "self"


async def set_app_record_bookmark_handler(
    *,
    person_id: uuid_str,
    record_id: uuid_str,
    data: AppRecordBookmarkRequest,
    uow: UnitOfWork,
) -> AppRecordResponse:
    membership = await FamilyFacade(uow).find_membership(person_id=person_id)
    if membership is None:
        raise EntityNotFoundException(f"기록을 찾을 수 없습니다: {record_id}")

    profiles = await FamilyFacade(uow).list_profiles(family_id=membership.family_id)
    entry = await LedgerFacade(uow).set_entry_bookmark(
        entry_id=record_id,
        person_id=person_id,
        shared_profile_ids=[p.id for p in profiles if p.relation != SELF_RELATION],
        private_profile_ids=[p.id for p in profiles if p.relation == SELF_RELATION],
        bookmarked=data.bookmarked,
    )

    # return
    return AppRecordResponse.of_entry(entry, person_id=person_id)
