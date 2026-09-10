"""field_note 파이프라인 dispatch가 emit→reaction→enqueue로 실제 라우팅되는지 검증.

test_12는 emit된 payload가 JOB_HANDLERS 시그니처에 바인딩됨만 봤다(정적). 여기선 워커
소비측을 실제로 구동: finish 요청이 emit한 field_note_pipeline_requested를 use_event_action
으로 claim → dispatch_event_handler(실 EVENT_REACTIONS) → enqueue_pipeline_dispatch_handler가
올바른 job_type/params로 enqueue하는지 단언. get_worker_batch_dispatcher를 레코더로 패치해
inline_executor(실 STT/LLM) 실행은 차단하고 enqueue만 포착한다.
"""
import inspect

import pytest

from app.application.events.dispatch import dispatch_event_handler
from app.application.events.routes import EVENT_REACTIONS
from app.application.jobs.routes import JOB_HANDLERS
from app.behavior.worker import use_event_action

from .test_13_eventing_outbox import _atomics_for_entity, _event


class _Recorder:
    def __init__(self):
        self.jobs: list[dict] = []

    async def dispatch(self, job_type, *, target_id, center_id, params=None):
        self.jobs.append(
            {
                "job_type": job_type,
                "target_id": target_id,
                "center_id": center_id,
                "params": params or {},
            }
        )


@pytest.fixture
def worker_recorder(monkeypatch):
    """반응의 get_worker_batch_dispatcher를 레코더로 — inline 실행(실 AI) 차단, enqueue만 포착."""
    rec = _Recorder()
    monkeypatch.setattr(
        "app.application.handlers.field_note.enqueue_pipeline_dispatch.get_worker_batch_dispatcher",
        lambda: rec,
    )
    return rec


async def _fresh_note(api, counselor, manager):
    for session in (counselor, manager):
        r = await api.post(
            f"/api/v1/centers/{session['center_id']}/field-notes",
            json={},
            headers=session["headers"],
        )
        if r.status_code == 201:
            return session, r.json()["id"]
    raise AssertionError(f"필드노트 생성 불가: {r.status_code} {r.text}")


async def _finish(api, session, note_id, *, auto_pipeline):
    r = await api.post(
        f"/api/v1/centers/{session['center_id']}/field-notes/{note_id}/finish",
        json={"total_duration": 3.0, "auto_pipeline": auto_pipeline},
        headers=session["headers"],
    )
    assert r.status_code == 200, r.text


async def _pipeline_event_group(note_id: str) -> str:
    atomics = [
        a for a in await _atomics_for_entity(note_id) if a.act == "pipeline_requested"
    ]
    assert atomics, f"field_note_pipeline_requested atomic 없음 (note={note_id})"
    return atomics[-1].event_id


async def _drive_reaction(event_group_id: str) -> None:
    """워커 소비 경로 실구동 — claim → dispatch(실 EVENT_REACTIONS) → succeed."""
    async with use_event_action(event_group_id) as scope:
        assert scope is not None, "pending 이벤트 claim 실패"
        await dispatch_event_handler(
            uow=scope.uow,
            center_id=scope.center_id,
            event_group_id=scope.event_group_id,
            table=EVENT_REACTIONS,
        )


# ── S1: finish(auto_pipeline) → "pipeline" 잡 enqueue ──────────────────────
async def test_finish_auto_pipeline_enqueues_pipeline(api, counselor, manager, worker_recorder):
    writer, note_id = await _fresh_note(api, counselor, manager)
    await _finish(api, writer, note_id, auto_pipeline=True)

    eg = await _pipeline_event_group(note_id)
    await _drive_reaction(eg)

    assert len(worker_recorder.jobs) == 1, f"pipeline 1건 enqueue 기대: {worker_recorder.jobs}"
    job = worker_recorder.jobs[0]
    assert job["job_type"] == "pipeline", job
    assert job["target_id"] == note_id
    assert job["center_id"] == writer["center_id"]
    assert "skip_refine" in job["params"]
    assert (await _event(eg)).status == "succeeded", "반응 성공 시 이벤트 succeeded"


# ── S2: finish(비auto) → "transcribe" 잡 enqueue ───────────────────────────
async def test_finish_transcribe_only_enqueues_transcribe(api, counselor, manager, worker_recorder):
    writer, note_id = await _fresh_note(api, counselor, manager)
    await _finish(api, writer, note_id, auto_pipeline=False)

    eg = await _pipeline_event_group(note_id)
    await _drive_reaction(eg)

    assert len(worker_recorder.jobs) == 1, worker_recorder.jobs
    assert worker_recorder.jobs[0]["job_type"] == "transcribe", worker_recorder.jobs[0]


# ── S3: enqueue된 job_type/params가 실 executor 시그니처에 바인딩 ──────────
async def test_enqueued_job_binds_to_job_handler(api, counselor, manager, worker_recorder):
    writer, note_id = await _fresh_note(api, counselor, manager)
    await _finish(api, writer, note_id, auto_pipeline=True)
    await _drive_reaction(await _pipeline_event_group(note_id))

    job = worker_recorder.jobs[0]
    handler = JOB_HANDLERS.get(job["job_type"])
    assert handler is not None, f"JOB_HANDLERS에 없는 job_type: {job['job_type']}"
    inspect.signature(handler).bind(
        field_note_id=job["target_id"],
        center_id=job["center_id"],
        **job["params"],
    )


# ── S4: 반응 체크포인트 기록 — 재시도 시 skip 되게 ─────────────────────────
async def test_reaction_checkpoint_recorded(api, counselor, manager, worker_recorder):
    writer, note_id = await _fresh_note(api, counselor, manager)
    await _finish(api, writer, note_id, auto_pipeline=True)
    eg = await _pipeline_event_group(note_id)
    await _drive_reaction(eg)

    from app.modules.event.event_reaction.repository import EventReactionRepository
    from app.infrastructure.persistence.database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        done = await EventReactionRepository(s).completed(event_id=eg)
    assert "enqueue_pipeline_dispatch_handler" in done, (
        f"성공 반응이 event_reactions 체크포인트에 기록되어야: {done}"
    )
