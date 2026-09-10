from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppRecordCreateRequest, AppRecordResponse
from app.modules.family.facade import FamilyFacade
from app.modules.ledger.ledger_entry.models import LedgerMood
from app.modules.ledger.facade import LedgerFacade


async def create_app_record_handler(
    *,
    person_id: uuid_str,
    data: AppRecordCreateRequest,
    uow: UnitOfWork,
) -> AppRecordResponse:
    family_facade = FamilyFacade(uow)
    membership = await family_facade.find_membership(person_id=person_id)
    if membership is None:
        raise EntityNotFoundException("가족을 찾을 수 없습니다")

    # 귀속 프로필이 내 가족 것인지 검증 — 없으면 404 (G2)
    await family_facade.get_profile(
        profile_id=data.profile_id,
        family_id=membership.family_id,
    )

    entry = await LedgerFacade(uow).create_entry(
        profile_id=data.profile_id,
        author_person_id=person_id,
        client_key=data.client_key,
        occurred_at=data.occurred_at,
        mood=LedgerMood(data.mood),
        body=data.body,
        private_memo=data.private_memo,
    )

    # return
    return AppRecordResponse.of_entry(entry, person_id=person_id)
