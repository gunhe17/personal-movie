"""WorkerConsumer stream/group 격리 회귀 테스트.

핵심 불변식 (P0b — batch 전용 워커 도입 선결):
- 같은 WorkerConsumer 클래스로 stream/group 을 인스턴스 단위 분리할 수 있어야 한다.
- batch consumer 는 자기 stream/group('ai:jobs:batch'/'batch-workers')에만
  XACK 한다 — field_note 그룹('ai:jobs'/'ai-workers')을 오염시키면 안 된다.
- 기본 생성(인자 없음)은 기존 field_note 값으로 동작(회귀 없음).

XACK 이 모듈상수가 아닌 인스턴스 필드를 쓰는지 못박는다(검토에서 지목된
핫패스 회귀 지점).
"""
from unittest.mock import AsyncMock

import pytest

from app.worker.stream.consumer import WorkerConsumer


def _redis_entry(job_type: str, resource_id: str = "vf-uuid-12345678") -> dict:
    return {
        "job_id": "job-1",
        "job_type": job_type,
        "field_note_id": resource_id,
        "center_id": "",
        "params": "{}",
        "created_at": "0",
    }


async def test_batch_consumer_acks_to_its_own_stream_and_group():
    redis = AsyncMock()
    ran: dict = {}

    async def _dummy(target_id, *, center_id, **params):
        ran["args"] = (target_id, center_id, params)

    consumer = WorkerConsumer(
        redis,
        consumer_name="batch-1",
        stream_key="ai:jobs:batch",
        group_name="batch-workers",
        table={"test_batch_isolation_ack": _dummy},
    )

    await consumer._process_message(
        "msg-1", _redis_entry("test_batch_isolation_ack")
    )

    # executor 가 resource id 슬롯을 그대로 받는다
    assert ran["args"][0] == "vf-uuid-12345678"
    # XACK 은 batch stream/group 으로만 — field_note 그룹 미오염
    redis.xack.assert_awaited_once_with(
        "ai:jobs:batch", "batch-workers", "msg-1"
    )


async def test_default_consumer_acks_to_field_note_stream():
    redis = AsyncMock()

    async def _dummy(target_id, *, center_id, **params):
        pass

    consumer = WorkerConsumer(redis, table={"test_default_isolation_ack": _dummy})

    await consumer._process_message(
        "msg-2", _redis_entry("test_default_isolation_ack")
    )

    redis.xack.assert_awaited_once_with("ai:jobs", "ai-workers", "msg-2")


async def test_ensure_group_uses_instance_stream_group():
    redis = AsyncMock()
    consumer = WorkerConsumer(
        redis, stream_key="ai:jobs:batch", group_name="batch-workers"
    )

    await consumer._ensure_group()

    redis.xgroup_create.assert_awaited_once_with(
        "ai:jobs:batch", "batch-workers", id="0", mkstream=True
    )


async def test_batch_reclaim_reprocesses_and_acks_stuck_message():
    redis = AsyncMock()
    # 첫 sweep: 고착 메시지 1건 반환, 다음 커서 종료
    redis.xautoclaim.return_value = (
        "0-0",
        [("stuck-1", _redis_entry("test_reclaim_ack"))],
        [],
    )
    ran: dict = {}

    async def _dummy(target_id, *, center_id, **params):
        ran["ok"] = True

    consumer = WorkerConsumer(
        redis,
        consumer_name="batch-1",
        stream_key="ai:jobs:batch",
        group_name="batch-workers",
        reclaim_min_idle_ms=600_000,
        table={"test_reclaim_ack": _dummy},
    )

    await consumer._reclaim()

    redis.xautoclaim.assert_awaited()  # sweep 발생
    assert ran.get("ok") is True       # 재처리됨
    redis.xack.assert_awaited_with("ai:jobs:batch", "batch-workers", "stuck-1")


def test_field_note_consumer_has_reclaim_disabled():
    consumer = WorkerConsumer(AsyncMock())  # 기본 = field_note
    assert consumer._reclaim_min_idle_ms is None
