from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.client_app.schemas import AppRecordMediaResponse, AppRecordResponse
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade
from app.modules.person.facade import PersonFacade

SELF_RELATION = "self"


async def get_app_record_handler(
    *,
    person_id: uuid_str,
    record_id: uuid_str,
    uow: UnitOfWork,
) -> AppRecordResponse:
    membership = await FamilyFacade(uow).find_membership(person_id=person_id)
    if membership is None:
        raise EntityNotFoundException(f"기록을 찾을 수 없습니다: {record_id}")

    profiles = await FamilyFacade(uow).list_profiles(family_id=membership.family_id)
    entry = await LedgerFacade(uow).get_entry(
        entry_id=record_id,
        person_id=person_id,
        shared_profile_ids=[p.id for p in profiles if p.relation != SELF_RELATION],
        private_profile_ids=[p.id for p in profiles if p.relation == SELF_RELATION],
    )
    persons = await PersonFacade(uow).get_persons_by_ids([entry.author_person_id])
    author_names = {pid: p.name for pid, p in persons.items()}
    media_rows = await LedgerFacade(uow).list_media(entry_ids=[entry.id])

    media = [
        AppRecordMediaResponse(
            id=m.id,
            media_type=m.media_type,
            upload_status=m.upload_status,
            duration_ms=m.duration_ms,
            width=m.width,
            height=m.height,
            url=(
                await get_storage_client().get_presigned_url(m.storage_path)
                if m.upload_status == "ready"
                else None
            ),
        )
        for m in media_rows
    ]

    # return
    return AppRecordResponse.of_entry(
        entry,
        person_id=person_id,
        author_names=author_names,
        media=media,
    )
