"""필드노트 API 전 표면 + 잡 배선(@register → JOB_HANDLERS) 회귀.

생성→목록→엔트리→오디오→종료→일정연결→화자맵→내보내기→삭제를 걷고,
디스패치된 모든 job_type이 JOB_HANDLERS에 존재하며 executor 시그니처에
바인딩 가능함을 검증한다 (레코더 디스패처가 발행 내역을 수집).
"""
import inspect
import io

import pytest

from .helpers import first_room_id, member_id_by_name

DAY = "2026-09-02"


@pytest.fixture
def local_storage(monkeypatch):
    """스토리지를 로컬로 강제 — get_storage_client가 lru_cache라 캐시도 비운다."""
    from app.core.config import settings
    from app.infrastructure.storage import factory

    monkeypatch.setattr(settings, "S3_BUCKET_ENABLED", False)
    factory.get_storage_client.cache_clear()
    yield
    factory.get_storage_client.cache_clear()


async def _emitted_pipeline_jobs(note_id: str) -> list[dict]:
    """emit→reaction으로 이관된 파이프라인 dispatch를 event_atomics에서 복원.

    finish·transcribe·refine·summary·pipeline은 요청 recorder 대신 outbox로 발행되므로
    (eventing §1), 발행된 job_type/params가 JOB_HANDLERS 시그니처에 바인딩됨을 여기서 검증.
    """
    from sqlalchemy import text
    from app.infrastructure.persistence.database import AsyncSessionLocal

    async with AsyncSessionLocal() as s:
        rows = (
            await s.execute(
                text(
                    "SELECT payload FROM event_atomics "
                    "WHERE act = 'pipeline_requested' AND entity_id = :nid"
                ),
                {"nid": note_id},
            )
        ).all()
    return [
        {
            "job_type": p["job_type"],
            "resource_id": p["field_note_id"],
            "center_id": p["field_note_id"],
            "params": p["params"],
        }
        for (p,) in rows
    ]


async def _writer(api, counselor, manager):
    """WRITE_COUNSELING_NOTE 보유 세션 선택 (counselor 우선)."""
    for session in (counselor, manager):
        r = await api.post(
            f"/api/v1/centers/{session['center_id']}/field-notes",
            json={},
            headers=session["headers"],
        )
        if r.status_code == 201:
            return session, r.json()
    raise AssertionError(f"필드노트 생성 불가: {r.status_code} {r.text}")


async def test_field_note_api_surface(api, counselor, manager, dispatched_jobs, local_storage):
    writer, note = await _writer(api, counselor, manager)
    cid = writer["center_id"]
    headers = writer["headers"]
    note_id = note["id"]

    # config
    r = await api.get(f"/api/v1/centers/{cid}/field-notes/config", headers=headers)
    assert r.status_code == 200 and "stt_mode" in r.json(), r.text

    # list / unlinked / linkable-tasks
    r = await api.get(f"/api/v1/centers/{cid}/field-notes", headers=headers)
    assert r.status_code == 200, r.text
    assert any(item["id"] == note_id for item in r.json()["items"]), "생성 노트가 목록에 없음"

    r = await api.get(f"/api/v1/centers/{cid}/field-notes/unlinked", headers=headers)
    assert r.status_code == 200, r.text

    r = await api.get(f"/api/v1/centers/{cid}/field-notes/linkable-tasks", headers=headers)
    assert r.status_code == 200, r.text

    # detail
    r = await api.get(f"/api/v1/centers/{cid}/field-notes/{note_id}", headers=headers)
    assert r.status_code == 200 and r.json()["id"] == note_id, r.text

    # entry
    r = await api.post(
        f"/api/v1/centers/{cid}/field-notes/{note_id}/entries",
        json={"entry_type": "memo", "content": "E2E 메모", "timestamp_seconds": 1.5},
        headers=headers,
    )
    assert r.status_code == 201, r.text

    r = await api.post(
        f"/api/v1/centers/{cid}/field-notes/{note_id}/audio",
        files={"file": ("chunk.webm", io.BytesIO(b"e2e-audio-bytes"), "audio/webm")},
        data={"duration": "3.0"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    audio_id = r.json()["id"]

    r = await api.get(
        f"/api/v1/centers/{cid}/field-notes/{note_id}/audio/{audio_id}/download-url",
        headers=headers,
    )
    assert r.status_code == 200 and r.json().get("download_url"), r.text

    # finish — auto_pipeline로 "pipeline" 잡 발행 경로 검증
    r = await api.post(
        f"/api/v1/centers/{cid}/field-notes/{note_id}/finish",
        json={"total_duration": 3.0, "auto_pipeline": True},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    # link-schedule + statuses + by-schedule
    room_id = await first_room_id(api, manager)
    counselor_id = await member_id_by_name(api, manager, "정상담")
    r = await api.post(
        f"/api/v1/centers/{manager['center_id']}/schedules/",
        json={
            "schedule_type": "meeting",
            "title": "E2E 필드노트 일정",
            "member_id": counselor_id,
            "room_id": room_id,
            "start": f"{DAY}T10:00:00",
            "end": f"{DAY}T11:00:00",
        },
        headers=manager["headers"],
    )
    assert r.status_code in (200, 201), r.text
    schedule_id = r.json()["id"]

    r = await api.post(
        f"/api/v1/centers/{cid}/field-notes/{note_id}/link-schedule",
        json={"schedule_id": schedule_id},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    r = await api.get(
        f"/api/v1/centers/{cid}/field-notes/statuses",
        params={"schedule_ids": schedule_id},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    r = await api.get(
        f"/api/v1/centers/{cid}/field-notes/by-schedule/{schedule_id}",
        headers=headers,
    )
    assert r.status_code == 200, r.text

    # by-task — 미연결 task id는 빈 목록
    r = await api.get(
        f"/api/v1/centers/{cid}/field-notes/by-task/00000000-0000-0000-0000-000000000000",
        headers=headers,
    )
    assert r.status_code == 200 and r.json() == [], r.text

    # speaker-map
    r = await api.patch(
        f"/api/v1/centers/{cid}/field-notes/{note_id}/speaker-map",
        json={"speaker_map": {"spk_0": "상담사"}},
        headers=headers,
    )
    assert r.status_code == 200, r.text

    # export — 전사 없으면 도메인 예외(4xx) 허용
    r = await api.get(
        f"/api/v1/centers/{cid}/field-notes/{note_id}/export",
        params={"format": "text"},
        headers=headers,
    )
    assert r.status_code in (200, 400, 404, 422), r.text

    # pipeline 스텝 — 응답은 200 PipelineStepResponse (started/precondition 등 status로 표현)
    for step in ("transcribe", "refine", "generate-summary"):
        r = await api.post(
            f"/api/v1/centers/{cid}/field-notes/{note_id}/{step}",
            headers=headers,
        )
        assert r.status_code == 200, f"{step}: {r.status_code} {r.text}"

    # delete
    r = await api.delete(f"/api/v1/centers/{cid}/field-notes/{note_id}", headers=headers)
    assert r.status_code == 204, r.text

    # 잡 배선 회귀 — 요청 recorder(transcribe_chunk) + outbox 발행(finish·pipeline 등)
    # 양쪽의 job_type이 JOB_HANDLERS에 있고 시그니처에 바인딩됨을 검증.
    from app.application.jobs.routes import JOB_HANDLERS

    emitted = await _emitted_pipeline_jobs(note_id)
    assert any(j["job_type"] == "pipeline" for j in emitted), (
        "finish(auto_pipeline)가 pipeline dispatch를 emit하지 않음"
    )

    all_jobs = list(dispatched_jobs) + emitted
    assert all_jobs, "디스패치/발행된 잡이 없음"
    for job in all_jobs:
        handler = JOB_HANDLERS.get(job["job_type"])
        assert handler is not None, f"JOB_HANDLERS에 없는 job_type: {job['job_type']}"
        inspect.signature(handler).bind(
            field_note_id=job["resource_id"],
            center_id=job["center_id"],
            **job["params"],
        )
