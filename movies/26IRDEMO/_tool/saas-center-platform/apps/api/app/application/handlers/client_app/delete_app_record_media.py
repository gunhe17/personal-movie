from app.core.exceptions import EntityNotFoundException, PermissionDeniedException
from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade

logger = get_logger(__name__)

SELF_RELATION = "self"
OWNER_ROLE = "owner"


async def delete_app_record_media_handler(
    *,
    person_id: uuid_str,
    record_id: uuid_str,
    media_id: uuid_str,
    uow: UnitOfWork,
) -> None:
    membership = await FamilyFacade(uow).find_membership(person_id=person_id)
    if membership is None:
        raise EntityNotFoundException(f"기록을 찾을 수 없습니다: {record_id}")

    profiles = await FamilyFacade(uow).list_profiles(family_id=membership.family_id)
    ledger = LedgerFacade(uow)
    entry = await ledger.get_entry(
        entry_id=record_id,
        person_id=person_id,
        shared_profile_ids=[p.id for p in profiles if p.relation != SELF_RELATION],
        private_profile_ids=[p.id for p in profiles if p.relation == SELF_RELATION],
    )
    # 작성자 본인 + 가족 관리자 (설계.md §15-6-4 권한 계단 — 분쟁 가정 문지기)
    if entry.author_person_id != person_id and membership.role != OWNER_ROLE:
        raise PermissionDeniedException("내가 쓴 기록의 첨부만 지울 수 있어요")

    media = await ledger.get_media(media_id=media_id, entry_id=record_id)
    await ledger.delete_media(media_id=media_id, entry_id=record_id)

    # 실파일은 롤백이 안 되므로 DB 삭제 뒤에 온다 — 실패해도 요청을 깨지 않는다(고아 파일만 잔존)
    try:
        await get_storage_client().delete_file(media.storage_path)
    except Exception:
        logger.warning("기록 첨부 파일 삭제 실패 — 고아 파일 잔존 가능", exc_info=True)
