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


async def delete_app_record_handler(
    *,
    person_id: uuid_str,
    record_id: uuid_str,
    uow: UnitOfWork,
) -> None:
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
        raise PermissionDeniedException("내가 쓴 기록만 삭제할 수 있어요")

    # 첨부 실파일까지 즉시 파기 — 본문만 지우면 사진·영상이 버킷에 남는다(설계.md §15-5)
    storage_paths = []
    for media in await ledger.list_media(entry_ids=[record_id]):
        storage_paths.append(media.storage_path)
        await ledger.delete_media(media_id=media.id, entry_id=record_id)

    await ledger.delete_entry(
        entry_id=record_id,
        person_id=person_id,
        shared_profile_ids=shared_ids,
        private_profile_ids=private_ids,
    )

    # 실파일은 롤백이 안 되므로 DB 삭제 뒤에 온다 — 실패해도 요청을 깨지 않는다(고아 파일만 잔존)
    storage = get_storage_client()
    for path in storage_paths:
        try:
            await storage.delete_file(path)
        except Exception:
            logger.warning("기록 첨부 파일 삭제 실패 — 고아 파일 잔존 가능", exc_info=True)
