from app.core.exceptions import EntityNotFoundException, PermissionDeniedException
from app.core.type import unset, uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppRecordUpdateRequest, AppRecordResponse
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.ledger_entry.models import LedgerMood
from app.modules.ledger.facade import LedgerFacade

SELF_RELATION = "self"
OWNER_ROLE = "owner"


async def update_app_record_handler(
    *,
    person_id: uuid_str,
    record_id: uuid_str,
    data: AppRecordUpdateRequest,
    uow: UnitOfWork,
) -> AppRecordResponse:
    membership = await FamilyFacade(uow).find_membership(person_id=person_id)
    if membership is None:
        raise EntityNotFoundException(f"기록을 찾을 수 없습니다: {record_id}")

    profiles = await FamilyFacade(uow).list_profiles(family_id=membership.family_id)
    shared_ids = [p.id for p in profiles if p.relation != SELF_RELATION]
    private_ids = [p.id for p in profiles if p.relation == SELF_RELATION]

    ledger = LedgerFacade(uow)
    entry = await ledger.get_entry(
        entry_id=record_id,
        person_id=person_id,
        shared_profile_ids=shared_ids,
        private_profile_ids=private_ids,
    )
    # 작성자 본인 + 가족 관리자 (설계.md §15-6-4 권한 계단 — 분쟁 가정 문지기)
    if entry.author_person_id != person_id and membership.role != OWNER_ROLE:
        raise PermissionDeniedException("내가 쓴 기록만 수정할 수 있어요")

    provided = data.model_dump(exclude_unset=True)
    mood = provided.get("mood", unset)
    updated = await ledger.update_entry(
        entry_id=record_id,
        person_id=person_id,
        shared_profile_ids=shared_ids,
        private_profile_ids=private_ids,
        occurred_at=provided.get("occurred_at", unset),
        mood=LedgerMood(mood) if isinstance(mood, str) else mood,
        body=provided.get("body", unset),
        private_memo=provided.get("private_memo", unset),
    )

    # return
    return AppRecordResponse.of_entry(updated, person_id=person_id)
