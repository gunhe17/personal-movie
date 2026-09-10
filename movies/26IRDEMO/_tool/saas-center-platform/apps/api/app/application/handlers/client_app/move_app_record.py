from app.core.exceptions import EntityNotFoundException, InvalidOperationException, PermissionDeniedException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppRecordMoveRequest, AppRecordResponse
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade

SELF_RELATION = "self"
OWNER_ROLE = "owner"


async def move_app_record_handler(
    *,
    person_id: uuid_str,
    record_id: uuid_str,
    data: AppRecordMoveRequest,
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
        raise PermissionDeniedException("내가 쓴 기록만 옮길 수 있어요")

    source = next(p for p in profiles if p.id == entry.profile_id)
    target = await FamilyFacade(uow).get_profile(
        profile_id=data.target_profile_id,
        family_id=membership.family_id,
    )
    # child ↔ self 이동은 가시성 스코프가 통째로 바뀐다 — 조용히 넘기지 않는다(설계.md §15-7)
    if source.relation != target.relation:
        raise InvalidOperationException(
            "본인 기록과 아이 기록은 서로 옮길 수 없어요 — 보이는 범위가 달라져요"
        )

    moved = await ledger.move_entry_profile(
        entry_id=record_id,
        person_id=person_id,
        shared_profile_ids=shared_ids,
        private_profile_ids=private_ids,
        target_profile_id=data.target_profile_id,
    )

    # return
    return AppRecordResponse.of_entry(moved, person_id=person_id)
