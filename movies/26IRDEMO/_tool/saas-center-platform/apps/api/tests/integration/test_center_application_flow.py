"""center application 회귀 — create/cancel 핸들러가 account_id를 정상 전달하는지.
직전엔 handler가 account_id= 를 넘기는데 facade 파라미터가 person_id라 요청마다 TypeError로
전 엔드포인트가 깨져 있었다(테스트 부재로 은폐). account_id 정렬 후 정상 동작을 고정한다."""
from uuid import uuid4

from app.modules.center.center_application.handlers import (
    cancel_center_application_handler,
    create_center_application_handler,
)
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.center_application.schemas import CenterApplicationCreate


async def test_create_then_cancel_center_application(test_session):
    uow = UnitOfWork(test_session)
    account_id = "acc-1"

    # create — 직전엔 TypeError(account_id/person_id 불일치)
    created = await create_center_application_handler(
        data=CenterApplicationCreate(name="테스트 상담센터"),
        account_id=account_id,
        uow=uow,
        event_group_id=str(uuid4()),
        actor_id=account_id,
    )
    await uow.commit()
    assert created.name == "테스트 상담센터"
    assert created.status == "PENDING"

    # cancel — 본인(account_id) 신청 취소
    cancelled = await cancel_center_application_handler(
        application_id=created.id,
        account_id=account_id,
        uow=uow,
        event_group_id=str(uuid4()),
        actor_id=account_id,
    )
    await uow.commit()
    assert cancelled.id == created.id
