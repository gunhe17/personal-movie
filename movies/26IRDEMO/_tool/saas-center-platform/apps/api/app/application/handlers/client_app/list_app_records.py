from datetime import datetime

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.client_app.schemas import (
    AppRecordListResponse,
    AppRecordMediaResponse,
    AppRecordResponse,
)
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade
from app.modules.person.facade import PersonFacade

SELF_RELATION = "self"


async def list_app_records_handler(
    *,
    person_id: uuid_str,
    profile_id: str | None,
    cursor: datetime | None,
    limit: int,
    bookmarked_only: bool,
    occurred_from: datetime | None = None,
    occurred_to: datetime | None = None,
    uow: UnitOfWork,
) -> AppRecordListResponse:
    membership = await FamilyFacade(uow).find_membership(person_id=person_id)
    if membership is None:
        return AppRecordListResponse(items=[])

    profiles = await FamilyFacade(uow).list_profiles(family_id=membership.family_id)
    if profile_id is not None:
        profiles = [p for p in profiles if p.id == profile_id]
    shared_ids = [p.id for p in profiles if p.relation != SELF_RELATION]
    private_ids = [p.id for p in profiles if p.relation == SELF_RELATION]

    entries = await LedgerFacade(uow).list_entries(
        person_id=person_id,
        shared_profile_ids=shared_ids,
        private_profile_ids=private_ids,
        cursor=cursor,
        limit=limit,
        bookmarked_only=bookmarked_only,
        occurred_from=occurred_from,
        occurred_to=occurred_to,
    )
    persons = await PersonFacade(uow).get_persons_by_ids(
        [e.author_person_id for e in entries]
    )
    author_names = {pid: p.name for pid, p in persons.items()}
    media_rows = await LedgerFacade(uow).list_media(entry_ids=[e.id for e in entries])

    media_by_entry: dict[str, list[AppRecordMediaResponse]] = {}
    for m in media_rows:
        media_by_entry.setdefault(m.entry_id, []).append(
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
        )

    items = [
        AppRecordResponse.of_entry(
            e,
            person_id=person_id,
            author_names=author_names,
            media=media_by_entry.get(e.id, []),
        )
        for e in entries
    ]

    # return
    return AppRecordListResponse(
        items=items,
        next_cursor=entries[-1].occurred_at if len(entries) == limit else None,
    )
