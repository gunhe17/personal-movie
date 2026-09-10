from app.core.datetime_utils import utc_now
from app.core.exceptions import EntityNotFoundException, PermissionDeniedException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.modules.client_app.schemas import (
    AppRecordMediaResponse,
    AppRecordMediaUploadRequest,
    AppRecordMediaUploadResponse,
)
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.facade import LedgerFacade
from app.modules.ledger.ledger_media.models import LedgerMediaType

SELF_RELATION = "self"
OWNER_ROLE = "owner"
UPLOAD_URL_TTL = 900


async def create_app_record_media_upload_url_handler(
    *,
    person_id: uuid_str,
    record_id: uuid_str,
    data: AppRecordMediaUploadRequest,
    uow: UnitOfWork,
) -> AppRecordMediaUploadResponse:
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
        raise PermissionDeniedException("내가 쓴 기록에만 첨부할 수 있어요")

    now = utc_now()
    quota_month = now.strftime("%Y-%m")
    media_type = LedgerMediaType(data.media_type)
    storage_path = f"ledger/{entry.profile_id}/{record_id}/{now:%Y%m%d%H%M%S%f}"

    media = await ledger.reserve_media(
        entry_id=record_id,
        media_type=media_type,
        quota_month=quota_month,
        storage_path=storage_path,
        duration_ms=data.duration_ms,
        author_person_id=person_id,
    )

    # 서명 발급이 실패하면 예약도 함께 롤백된다 — 쓸 수 없는 URL의 쿼터 점유를 남기지 않는다
    upload_url = await get_storage_client().get_presigned_upload_url(
        storage_path,
        data.content_type,
        expires_in=UPLOAD_URL_TTL,
    )

    # return
    return AppRecordMediaUploadResponse(
        media=AppRecordMediaResponse(
            id=media.id,
            media_type=media.media_type,
            upload_status=media.upload_status,
            duration_ms=media.duration_ms,
        ),
        upload_url=upload_url,
        expires_in=UPLOAD_URL_TTL,
    )
