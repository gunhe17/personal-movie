"""E2E 이벤트 구조(outbox) 양성 검증.

리팩토링이 도입한 도메인 이벤트(behavior/eventing)의 핵심 계약을 실제 HTTP 쓰기로 확인한다:
- 쓰기 핸들러의 emit()이 비즈니스 변경과 같은 UoW 트랜잭션에서 events(그룹) +
  event_atomics(사실)를 적재한다 (app/modules/event/event/handlers/emit.py).
- 한 요청 = 한 event_group_id = events 1행 + 그 안의 atomic N행(sequence 0..N-1).
- 읽기는 이벤트를 만들지 않는다.
- worker(use_event_action + dispatch)가 pending → succeeded 로 진행시킨다.

외부 worker 프로세스 없이 in-process로 emit 결과를 DB에서 직접 조회해 단언한다.
events 모델 = app/modules/event/event/models.py, event_atomics = event_atomic/models.py.
"""
from sqlalchemy import func, select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.event.event.models import Event
from app.modules.event.event_atomic.models import EventAtomic

from .conftest import unique


async def _atomics_for_entity(entity_id: str) -> list[EventAtomic]:
    async with AsyncSessionLocal() as s:
        rows = (
            await s.execute(
                select(EventAtomic)
                .where(EventAtomic.entity_id == entity_id)
                .order_by(EventAtomic.sequence)
            )
        ).scalars().all()
        return list(rows)


async def _atomics_in_group(event_id: str) -> list[EventAtomic]:
    async with AsyncSessionLocal() as s:
        rows = (
            await s.execute(
                select(EventAtomic)
                .where(EventAtomic.event_id == event_id)
                .order_by(EventAtomic.sequence)
            )
        ).scalars().all()
        return list(rows)


async def _event(event_id: str) -> Event | None:
    async with AsyncSessionLocal() as s:
        return (
            await s.execute(select(Event).where(Event.id == event_id))
        ).scalar_one_or_none()


async def _events_count() -> int:
    async with AsyncSessionLocal() as s:
        return (await s.execute(select(func.count(Event.id)))).scalar_one()


# ── emit → outbox 원자적 적재 ─────────────────────────────────────────────
async def test_wired_write_persists_event_and_atomic(api, admin):
    """POST /clients/ (start_event_group 배선) → events('client_created') + atomic 1행.

    emit이 비즈니스 변경과 같은 트랜잭션에서 outbox에 적재됨을 증명한다.
    """
    cid = admin["center_id"]
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={"role": "client", "name": unique("이벤트검증아동"), "gender": "male"},
        headers=admin["headers"],
    )
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    client_id = r.json()["id"]

    atomics = await _atomics_for_entity(client_id)
    assert len(atomics) == 1, f"생성은 atomic 1행이어야: {len(atomics)}"
    a = atomics[0]
    assert a.entity_name == "client"
    assert a.act == "created"
    assert a.entity_id == client_id
    assert a.sequence == 0
    assert "data" in a.payload, f"created payload는 data 키: {a.payload.keys()}"

    event = await _event(a.event_id)
    assert event is not None, "events 그룹 행이 없음 — emit이 그룹을 안 만듦"
    assert event.name == "client_created"
    assert event.center_id == cid
    assert event.status == "pending", "worker 미가동이므로 적재 직후 pending 이어야"


# ── 한 요청의 atomic들이 한 event_group_id 아래로 묶임 ──────────────────────
async def test_batch_write_groups_atomics_under_one_event(api, admin):
    """배치 등록(보호자+자녀+관계)은 atomic 다건을 한 event_group으로 묶는다.

    sequence가 0..N-1 연속이고 모두 같은 event_id를 공유함을 단언.
    """
    cid = admin["center_id"]
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/batch",
        json={
            "guardians": [
                {
                    "name": unique("보호자"),
                    "phone": "010-2222-3333",
                    "relation_type": "parent",
                    "is_primary": True,
                }
            ],
            "children": [
                {"name": unique("자녀"), "birth_date": "2015-01-01", "gender": "male"}
            ],
        },
        headers=admin["headers"],
    )
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    child_id = r.json()["children"][0]["id"]

    seed = await _atomics_for_entity(child_id)
    assert seed, "자녀 atomic이 없음"
    event_id = seed[0].event_id

    group = await _atomics_in_group(event_id)
    assert len(group) >= 2, f"배치는 atomic 다건이어야(보호자+자녀+관계): {len(group)}"
    assert [a.sequence for a in group] == list(range(len(group))), "sequence 0..N-1 연속 위반"
    assert {a.event_id for a in group} == {event_id}, "한 그룹의 atomic이 event_id를 공유하지 않음"

    event = await _event(event_id)
    assert event is not None and event.name == "clients_created"


# ── 읽기는 이벤트를 만들지 않는다 ──────────────────────────────────────────
async def test_read_does_not_emit(api, admin):
    """GET(읽기)은 outbox를 건드리지 않는다 — events 행 수가 불변."""
    cid = admin["center_id"]
    before = await _events_count()
    r = await api.get(
        f"/api/v1/centers/{cid}/clients/",
        params={"page": 1, "size": 5},
        headers=admin["headers"],
    )
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    after = await _events_count()
    assert after == before, f"읽기가 이벤트를 생성함(outbox 오염): {before} → {after}"


# ── worker 소비 경로(claim→run→succeed) ───────────────────────────────────
async def test_dispatch_lifecycle_marks_event_succeeded(api, admin):
    """worker(use_event_action + dispatch)가 pending 이벤트를 succeeded로 종결.

    client_created는 등록된 reaction이 없어 dispatch는 즉시 통과하고, succeed가 상태를
    종결한다 — 이벤트 소비 경로 자체가 동작함을 증명.
    """
    cid = admin["center_id"]
    r = await api.post(
        f"/api/v1/centers/{cid}/clients/",
        json={"role": "client", "name": unique("소비검증아동"), "gender": "female"},
        headers=admin["headers"],
    )
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    client_id = r.json()["id"]
    event_group_id = (await _atomics_for_entity(client_id))[0].event_id

    assert (await _event(event_group_id)).status == "pending"

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

    event = await _event(event_group_id)
    assert event.status == "succeeded", f"소비 후 succeeded 여야: {event.status}"
    assert event.succeeded_at is not None
