"""실전 반응(EVENT_REACTIONS) E2E — 알림 반응이 워커 소비 경로로 실제 실행됨을 검증.

test_16이 가짜 Route로 dispatch 머시너리를 고정했다면, 여기는 실제 등록 반응
(notify_counseling_session_cancelled)을 real EVENT_REACTIONS로 태운다:
HTTP 쓰기(emit) → use_event_action(claim) → dispatch → Notification 행 + 체크포인트.

외부 채널은 test env에서 구조적으로 no-op: 알림톡은 KAKAO_NOTIFICATION_TEMPLATE_CODE=""
가드, 푸시는 seed에 토큰 없음.
"""
from uuid import uuid4

from sqlalchemy import select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.event.event.models import Event
from app.modules.event.event_atomic.models import EventAtomic
from app.modules.event.event_reaction.models import EventReaction
from app.modules.notification.notification.models import Notification

from .conftest import unique
from .helpers import first_program_id, first_room_id, member_id_by_name

D1 = "2026-09-17T05:00:00Z"


async def _fresh_client(api, session: dict) -> str:
    # 중복 접수 가드(동일 client+program 최근 생성) 회피 — 테스트마다 새 내담자
    r = await api.post(
        f"/api/v1/centers/{session['center_id']}/clients/",
        json={"role": "client", "name": unique("반응검증"), "gender": "male"},
        headers=session["headers"],
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _event_group_of(entity_id: str, act: str) -> str:
    async with AsyncSessionLocal() as s:
        atomic = (
            await s.execute(
                select(EventAtomic).where(
                    EventAtomic.entity_id == entity_id, EventAtomic.act == act
                )
            )
        ).scalar_one()
        return atomic.event_id


async def _consume(event_group_id: str) -> None:
    from app.application.events.dispatch import dispatch_event_handler
    from app.application.events.routes import EVENT_REACTIONS
    from app.behavior.worker import use_event_action

    async with use_event_action(event_group_id) as scope:
        assert scope is not None, "claim 실패 — 이미 점유됐거나 행 없음"
        await dispatch_event_handler(
            uow=scope.uow,
            center_id=scope.center_id,
            event_group_id=scope.event_group_id,
            table=EVENT_REACTIONS,
        )


async def test_cancel_session_reaction_creates_notification(api, manager):
    cid = manager["center_id"]
    headers = manager["headers"]

    # intake — 회기 1개 케이스
    r = await api.post(
        f"/api/v1/centers/{cid}/counseling/intake",
        json={
            "case": {
                "program_id": await first_program_id(api, manager),
                "client_ids": [await _fresh_client(api, manager)],
                "counselor_ids": [await member_id_by_name(api, manager, "정상담")],
                "chief_complaint": "반응 E2E",
            },
            "sessions": {
                "dates": [D1],
                "start_time": "15:00",
                "end_time": "15:50",
                "room_id": await first_room_id(api, manager),
                "duration_minutes": 50,
            },
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    case_id = r.json()["case_id"]

    s = await api.get(f"/api/v1/centers/{cid}/counseling/cases/{case_id}/sessions", headers=headers)
    assert s.status_code == 200, s.text
    session_id = s.json()["items"][0]["id"]

    # cancel — emit(counseling_session_cancelled), 알림은 아직 없음(반응 미소비)
    r = await api.post(
        f"/api/v1/centers/{cid}/counseling/sessions/{session_id}/cancel",
        json={"cancel_reason": "반응 검증"},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    # notify_bulk가 수신자별 event_ref = "{prefix}:{recipient_id}"로 저장 — prefix 조회
    event_ref = f"counseling_session:{session_id}:cancelled"
    async with AsyncSessionLocal() as db:
        before = (
            await db.execute(select(Notification).where(Notification.event_ref.like(f"{event_ref}%")))
        ).scalars().all()
    assert before == [], "소비 전엔 알림이 없어야 (producer에서 알림 소유 제거됨)"

    # consume — 실제 EVENT_REACTIONS로 반응 실행
    group_id = await _event_group_of(session_id, "cancelled")
    await _consume(group_id)

    async with AsyncSessionLocal() as db:
        event = (await db.execute(select(Event).where(Event.id == group_id))).scalar_one()
        assert event.status == "succeeded", f"{event.status} / attempts={event.attempts}"

        reactions = (
            await db.execute(select(EventReaction).where(EventReaction.event_id == group_id))
        ).scalars().all()
        assert [(x.reaction, x.ok) for x in reactions] == [
            ("notify_counseling_session_cancelled_handler", True)
        ]

        notifs = (
            await db.execute(select(Notification).where(Notification.event_ref.like(f"{event_ref}%")))
        ).scalars().all()
        assert len(notifs) == 1, f"담당 상담사 인앱 알림 1건이어야: {len(notifs)}"
        assert notifs[0].event_type == "session_cancelled"


async def test_cancel_reaction_rerun_is_idempotent(api, manager):
    """반응 재실행(재시도 시뮬레이션) 시 event_ref unique로 인앱 행이 중복되지 않는다."""
    cid = manager["center_id"]
    headers = manager["headers"]

    r = await api.post(
        f"/api/v1/centers/{cid}/counseling/intake",
        json={
            "case": {
                "program_id": await first_program_id(api, manager),
                "client_ids": [await _fresh_client(api, manager)],
                "counselor_ids": [await member_id_by_name(api, manager, "정상담")],
                "chief_complaint": "반응 멱등 E2E",
            },
            "sessions": {
                "dates": [D1],
                "start_time": "16:00",
                "end_time": "16:50",
                "room_id": await first_room_id(api, manager),
                "duration_minutes": 50,
            },
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    case_id = r.json()["case_id"]
    s = await api.get(f"/api/v1/centers/{cid}/counseling/cases/{case_id}/sessions", headers=headers)
    session_id = s.json()["items"][0]["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/counseling/sessions/{session_id}/cancel",
        json={},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    group_id = await _event_group_of(session_id, "cancelled")
    await _consume(group_id)

    # 재시도 시뮬레이션 — 체크포인트를 우회해 반응 본문을 직접 재실행
    from app.application.handlers.notification.notify_counseling_session_cancelled import (
        notify_counseling_session_cancelled_handler,
    )
    from app.infrastructure.persistence.unit_of_work import transactional_uow

    async with transactional_uow() as uow:
        await notify_counseling_session_cancelled_handler(
            uow=uow,
            center_id=cid,
            event_group_id=str(uuid4()),
            session_id=session_id,
            case_id=case_id,
        )

    event_ref = f"counseling_session:{session_id}:cancelled"
    async with AsyncSessionLocal() as db:
        notifs = (
            await db.execute(select(Notification).where(Notification.event_ref.like(f"{event_ref}%")))
        ).scalars().all()
    assert len(notifs) == 1, f"재실행에도 1건이어야(event_ref unique): {len(notifs)}"
