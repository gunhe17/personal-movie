"""회귀: nullable 필드(reference_id·memo)를 명시적 None으로 보내면 NULL로 비워져야 한다.
이전엔 service가 `if v is not None` 필터로 omit과 null을 합쳐 null-clear를 무음 드롭했다."""
from app.modules.billing.price_list.repository import PriceListRepository
from app.modules.billing.price_list.schemas import PriceListUpdate
from app.modules.billing.price_list.services.update_price_list import (
    UpdatePriceListService,
)


async def test_explicit_null_clears_reference_id(test_session):
    repo = PriceListRepository(test_session)
    record = await repo.add(
        center_id="center-1",
        service_type="counseling",
        service_name="개인상담",
        unit_price=50000,
        is_active=True,
        source="manual",
        created_by="admin-1",
        reference_id="abc",
        memo="x",
    )

    svc = UpdatePriceListService(repo)
    data = PriceListUpdate(reference_id=None)
    await svc.execute(
        price_list_id=record.id,
        center_id="center-1",
        changed=data.model_dump(mode="json", exclude_unset=True),
        **data.model_dump(exclude_unset=True),
    )

    persisted = await repo.get_in_center(price_list_id=record.id, center_id="center-1")
    assert persisted.reference_id is None
    assert persisted.memo == "x"


async def test_omitted_reference_id_is_preserved(test_session):
    repo = PriceListRepository(test_session)
    record = await repo.add(
        center_id="center-1",
        service_type="counseling",
        service_name="개인상담",
        unit_price=50000,
        is_active=True,
        source="manual",
        created_by="admin-1",
        reference_id="abc",
        memo="x",
    )

    svc = UpdatePriceListService(repo)
    data = PriceListUpdate(service_name="가족상담")
    await svc.execute(
        price_list_id=record.id,
        center_id="center-1",
        changed=data.model_dump(mode="json", exclude_unset=True),
        **data.model_dump(exclude_unset=True),
    )

    persisted = await repo.get_in_center(price_list_id=record.id, center_id="center-1")
    assert persisted.reference_id == "abc"
    assert persisted.service_name == "가족상담"
