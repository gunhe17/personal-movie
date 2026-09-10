from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
)
from app.core.logger import get_logger
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.client_app.schemas import (
    AppRecordMediaCompleteRequest,
    AppRecordMediaResponse,
)
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade
from app.modules.ledger.ledger_media.models import LedgerMediaType

logger = get_logger(__name__)

SELF_RELATION = "self"
OWNER_ROLE = "owner"
# 신고된 길이(duration_ms)는 서버가 검증할 수 없다 — 크기 상한이 그 대용이다.
# 1분 1080p는 넉넉히 잡아도 200MB대라, 이 선을 넘으면 신고 길이와 실물이 어긋난 것.
MAX_BYTES = {
    LedgerMediaType.VIDEO.value: 300 * 1024 * 1024,
    LedgerMediaType.IMAGE.value: 30 * 1024 * 1024,
}


async def complete_app_record_media_handler(
    *,
    person_id: uuid_str,
    record_id: uuid_str,
    media_id: uuid_str,
    data: AppRecordMediaCompleteRequest,
    uow: UnitOfWork,
) -> AppRecordMediaResponse:
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
        raise PermissionDeniedException("내가 쓴 기록에만 첨부할 수 있어요")

    reserved = await ledger.get_media(media_id=media_id, entry_id=record_id)

    # 직행 업로드라 서버는 완료를 못 본다 — 앱 말을 믿지 말고 객체를 직접 확인한다
    info = await get_storage_client().head_file(reserved.storage_path)
    if info is None:
        raise InvalidOperationException(
            "업로드가 확인되지 않았어요 — 다시 시도해 주세요"
        )

    limit = MAX_BYTES.get(reserved.media_type)
    if limit is not None and info["size"] > limit:
        await ledger.delete_media(media_id=media_id, entry_id=record_id)
        try:
            await get_storage_client().delete_file(reserved.storage_path)
        except Exception:
            logger.warning("기록 첨부 파일 삭제 실패 — 고아 파일 잔존 가능", exc_info=True)
        # tx 예외: 거부하되 예약 회수는 남긴다 — 롤백하면 초과 파일이 쿼터를 계속 문다
        await uow.reject(
            InvalidOperationException("파일이 너무 커요 — 촬영 길이를 확인해 주세요")
        )

    media = await ledger.complete_media(
        media_id=media_id,
        entry_id=record_id,
        checksum=data.checksum,
        width=data.width,
        height=data.height,
    )

    # return
    return AppRecordMediaResponse(
        id=media.id,
        media_type=media.media_type,
        upload_status=media.upload_status,
        duration_ms=media.duration_ms,
        width=media.width,
        height=media.height,
    )
