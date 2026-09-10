from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.application.handlers.assessment.verify_send_result import (
    verify_send_result_handler,
)
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.send_result.models import AssessmentSendResult
from app.modules.assessment.send_result.repository import (
    AssessmentSendResultRepository,
)


@pytest.mark.asyncio
async def test_verify_failure_persists_failed_attempts(test_session, test_engine):
    # seed: 인증코드 1234, 실패횟수 0
    sr_id = str(uuid4())
    test_session.add(
        AssessmentSendResult(
            id=sr_id,
            center_id="center-1",
            case_id="case-1",
            verification_code="1234",
            failed_attempts=0,
            recipients=[],
            channel="alarmtalk",
        )
    )
    await test_session.commit()

    uow = UnitOfWork(test_session)

    # 잘못된 코드 → InvalidOperationException. reject가 failed_attempts 증가분을 commit.
    with pytest.raises(InvalidOperationException):
        await verify_send_result_handler(
            send_result_id=sr_id,
            verification_code="9999",
            uow=uow,
            storage=AsyncMock(),
            event_group_id="eg-verify-fail",
        )

    # 별도 세션에서 읽어 영속 확인 — reject(commit) 아니라 rollback이었으면 0
    maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as fresh:
        sr = await AssessmentSendResultRepository(fresh).get_by_id_public(
            send_result_id=sr_id
        )
    assert sr.failed_attempts == 1


@pytest.mark.asyncio
async def test_verify_success_emits_guest_verified_event(test_session):
    from sqlalchemy import select

    from app.modules.event.event.models import Event

    sr_id = str(uuid4())
    test_session.add(
        AssessmentSendResult(
            id=sr_id,
            center_id="center-1",
            case_id="case-1",
            verification_code="1234",
            failed_attempts=0,
            recipients=[],
            channel="alarmtalk",
        )
    )
    await test_session.commit()

    uow = UnitOfWork(test_session)
    resp = await verify_send_result_handler(
        send_result_id=sr_id,
        verification_code="1234",
        uow=uow,
        storage=AsyncMock(),
        event_group_id="eg-verify-ok",
    )
    await test_session.commit()

    assert resp is not None
    # guest 접근 감사 이벤트가 아웃박스에 기록됐다
    row = (
        await test_session.execute(
            select(Event).where(Event.name == "assessment_send_result_verified")
        )
    ).scalars().first()
    assert row is not None
    assert row.actor_type == "guest"
