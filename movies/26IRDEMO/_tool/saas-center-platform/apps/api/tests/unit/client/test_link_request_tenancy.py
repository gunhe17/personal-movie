"""C-H1 회귀: 연동요청 승인/거부는 호출자 center 로 스코프 — 타 센터 request_id 는 404.
이전엔 service 가 get_by_id(전역)라 center-A 관리자가 center-B 의 연동요청을 승인/거부할 수 있었다."""
from datetime import datetime

import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.client.link_request.repository import ClientLinkRequestRepository
from app.modules.client.link_request.services import (
    ApproveLinkRequestService,
    RejectLinkRequestService,
)


async def _make_request(repo):
    return await repo.add(
        center_id="center-B",
        person_id="person-1",
        phone="010-0000-0000",
        requested_at=datetime(2026, 6, 24, 0, 0, 0),
    )


async def test_approve_rejects_foreign_center(test_session):
    repo = ClientLinkRequestRepository(test_session)
    req = await _make_request(repo)

    with pytest.raises(EntityNotFoundException):
        await ApproveLinkRequestService(repo).execute(
            request_id=req.id, client_id="client-1", center_id="center-A"
        )


async def test_reject_rejects_foreign_center(test_session):
    repo = ClientLinkRequestRepository(test_session)
    req = await _make_request(repo)

    with pytest.raises(EntityNotFoundException):
        await RejectLinkRequestService(repo).execute(
            request_id=req.id, center_id="center-A"
        )

    # 같은 센터는 정상 처리
    atomic, rejected = await RejectLinkRequestService(repo).execute(
        request_id=req.id, center_id="center-B"
    )
    assert rejected.status == "rejected"
    assert atomic.act() == "rejected"
