"""소유 스코프 회귀: 남의 행은 조회 단계에서 없는 것으로 수렴한다.

이전엔 `get_by_id` 로 꺼낸 뒤 `if row.owner != me: raise` 로 분기했다 — 분기를 빼먹으면
조용히 남의 행이 열린다. 스코프를 WHERE로 내리면 빼먹을 자리가 없다
(persistence-repository.md §7 "검증 분기 불필요").
"""
from datetime import datetime, timedelta

import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.auth.token.repository import RefreshTokenRepository
from app.modules.center.center_application.repository import CenterApplicationRepository
from app.modules.notification.notification_setting.repository import (
    NotificationSettingRepository,
)
from app.modules.notification.push_token.repository import PushTokenRepository
from app.modules.person.credential.repository import PersonCredentialRepository

MINE, OTHER = "owner-1", "owner-2"


async def test_credential_scoped_by_person(test_session):
    repo = PersonCredentialRepository(test_session)
    row = await repo.add(
        person_id=MINE,
        credential_type="certification",
        title="상담심리사 2급",
        organization="한국상담심리학회",
    )
    await test_session.flush()

    assert (await repo.get_by_person(row.id, person_id=MINE)).id == row.id
    with pytest.raises(EntityNotFoundException):
        await repo.get_by_person(row.id, person_id=OTHER)


async def test_center_application_scoped_by_account(test_session):
    repo = CenterApplicationRepository(test_session)
    row = await repo.add(created_by=MINE, name="테스트센터", status="pending")
    await test_session.flush()

    assert (await repo.get_by_account(row.id, account_id=MINE)).id == row.id
    with pytest.raises(EntityNotFoundException):
        await repo.get_by_account(row.id, account_id=OTHER)


async def test_refresh_token_scoped_by_account(test_session):
    repo = RefreshTokenRepository(test_session)
    row = await repo.add(
        account_id=MINE,
        token_hash="h1",
        expires_at=datetime.utcnow() + timedelta(days=1),
    )
    await test_session.flush()

    assert (await repo.get_by_account(row.id, account_id=MINE)).id == row.id
    with pytest.raises(EntityNotFoundException):
        await repo.get_by_account(row.id, account_id=OTHER)


async def test_notification_setting_scoped_by_center_and_account(test_session):
    repo = NotificationSettingRepository(test_session)
    row = await repo.add(
        account_id=MINE,
        category="schedule",
        channel_in_app=True,
        channel_push=True,
        channel_alarmtalk=False,
        center_id="C1",
    )
    await test_session.flush()

    assert (await repo.get_owned(row.id, center_id="C1", account_id=MINE)).id == row.id
    with pytest.raises(EntityNotFoundException):
        await repo.get_owned(row.id, center_id="C1", account_id=OTHER)
    with pytest.raises(EntityNotFoundException):
        await repo.get_owned(row.id, center_id="C2", account_id=MINE)


async def test_push_token_scoped_by_account(test_session):
    repo = PushTokenRepository(test_session)
    await repo.add(center_id="C1", account_id=MINE, token="tok-1", platform="ios")
    await test_session.flush()

    assert await repo.find_by_token_and_account("tok-1", account_id=MINE) is not None
    assert await repo.find_by_token_and_account("tok-1", account_id=OTHER) is None
