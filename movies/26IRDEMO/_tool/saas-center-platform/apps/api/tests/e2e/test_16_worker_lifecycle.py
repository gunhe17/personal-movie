"""이벤트 워커 소비 라이프사이클 + 반응(reaction) 머시너리 검증 (C-2·C-5).

test_13은 happy-path(emit→outbox→claim→succeed)만 봤다. 여기선 소비측의 나머지를 검증:
- claim(lease) → succeed 상태 전이
- fail → attempts++ · backoff(next_attempt_at) · 재시도 가능 상태
- claim_stale(sweeper) — pending(+due) 픽업
- dispatch 반응 fan-out — EVENT_REACTIONS에 반응 등록 시 실행 + event_reactions 체크포인트
- 반응 실패 격리 — 한 반응 실패가 event_reactions에 ok=False로 기록되고 dispatch가 raise

fan-out/실패는 테스트가 가짜 Route table을 dispatch_event_handler에 직접 주입해 머시너리만
검증한다(프로덕션 반응 불필요, 전역 mutation 없음).
"""
from app.application.events.dispatch import Route, dispatch_event_handler
from app.behavior.worker import use_event_action
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.event.event.models import Event
from app.modules.event.event.repository import EventRepository

from .conftest import unique
from .test_13_eventing_outbox import _atomics_for_entity, _event


async def _emit_client_event(api, admin) -> str:
    """client 생성 → 그 쓰기의 event_group_id 반환 (pending 이벤트 1건)."""
    r = await api.post(
        f"/api/v1/centers/{admin['center_id']}/clients/",
        json={"role": "client", "name": unique("워커검증아동"), "gender": "male"},
        headers=admin["headers"],
    )
    assert r.status_code in (200, 201), r.text
    return (await _atomics_for_entity(r.json()["id"]))[0].event_id


# ── claim → succeed ───────────────────────────────────────────────────────
async def test_claim_then_succeed(api, admin):
    eg = await _emit_client_event(api, admin)
    async with AsyncSessionLocal() as s:
        claimed = await EventRepository(s).claim(id=eg)
        await s.commit()
    assert claimed is not None, "pending+due 이벤트는 claim 가능해야"
    assert claimed.status == "claimed"
    assert claimed.claimed_at is not None

    async with AsyncSessionLocal() as s:
        await EventRepository(s).succeed(id=eg)
        await s.commit()
    ev = await _event(eg)
    assert ev.status == "succeeded" and ev.succeeded_at is not None


# ── fail → attempts++ · backoff ───────────────────────────────────────────
async def test_fail_increments_attempts_and_sets_backoff(api, admin):
    eg = await _emit_client_event(api, admin)
    async with AsyncSessionLocal() as s:
        await EventRepository(s).claim(id=eg)
        await s.commit()

    async with AsyncSessionLocal() as s:
        await EventRepository(s).fail(id=eg)
        await s.commit()

    ev = await _event(eg)
    assert len(ev.attempts) == 1, f"attempts 1 기록되어야: {ev.attempts}"
    assert ev.status == "pending", "max 미만이면 재시도 위해 pending"
    assert ev.next_attempt_at is not None, "backoff 스케줄(next_attempt_at) 설정되어야"
    assert ev.failed_at is None


# ── claim_stale(sweeper) — pending+due 픽업 ────────────────────────────────
async def test_claim_stale_picks_up_due_pending(api, admin):
    eg = await _emit_client_event(api, admin)  # next_attempt_at=None → 즉시 due
    async with AsyncSessionLocal() as s:
        due_ids = await EventRepository(s).claim_stale(limit=1000)
    assert eg in due_ids, "sweeper가 due pending 이벤트를 픽업해야"


# ── dispatch 반응 fan-out + 체크포인트 ─────────────────────────────────────
# 가짜 반응 = leaf handler + Route. dispatch_event_handler에 table을 직접 넘긴다(전역 mutation 없음).
_RAN: list = []


async def _fake_handler(*, uow, center_id, event_group_id, data):
    _RAN.append(data)


async def _fail_handler(*, uow, center_id, event_group_id, data):
    raise ValueError("의도된 반응 실패")


_fake_route = Route(
    handler=_fake_handler, source="client.created",
    project=lambda p: {"data": p["data"]}, name="fake_test_reaction",
)
_fail_route = Route(
    handler=_fail_handler, source="client.created",
    project=lambda p: {"data": p["data"]}, name="fail_test_reaction",
)


async def test_dispatch_runs_registered_reaction(api, admin):
    eg = await _emit_client_event(api, admin)
    _RAN.clear()
    async with use_event_action(eg) as scope:
        assert scope is not None
        await dispatch_event_handler(
            uow=scope.uow, center_id=scope.center_id,
            event_group_id=scope.event_group_id,
            table={"client_created": [_fake_route]},
        )

    assert len(_RAN) == 1, "등록 반응이 atomic payload로 1회 실행되어야"
    assert "center_id" in _RAN[0], f"반응 payload가 client여야: {_RAN[0].keys()}"

    from app.modules.event.event_reaction.repository import EventReactionRepository
    async with AsyncSessionLocal() as s:
        done = await EventReactionRepository(s).completed(event_id=eg)
    assert "fake_test_reaction" in done, "성공 반응이 event_reactions 체크포인트에 기록되어야"
    assert (await _event(eg)).status == "succeeded"


# ── 반응 실패 격리 — ok=False 기록 + dispatch raise ───────────────────────
async def test_reaction_failure_marks_not_ok_and_fails_event(api, admin):
    eg = await _emit_client_event(api, admin)
    raised = False
    try:
        async with use_event_action(eg) as scope:
            assert scope is not None
            await dispatch_event_handler(
                uow=scope.uow, center_id=scope.center_id,
                event_group_id=scope.event_group_id,
                table={"client_created": [_fail_route]},
            )
    except Exception:
        raised = True

    assert raised, "반응 실패는 dispatch→use_event_action을 통해 raise되어야"

    # 실패 반응은 완료(ok=True) 체크포인트에 없어야(재시도 대상), 이벤트는 재시도/종료 상태.
    from app.modules.event.event_reaction.repository import EventReactionRepository
    async with AsyncSessionLocal() as s:
        done = await EventReactionRepository(s).completed(event_id=eg)
    assert "fail_test_reaction" not in done, "실패 반응은 완료(ok=True) 목록에 없어야"
    ev = await _event(eg)
    assert ev.status in ("pending", "failed"), f"실패 후 재시도/종료 상태여야: {ev.status}"
    assert len(ev.attempts) >= 1
