"""Batch 워커 — 즉시 응답이 필요 없는 여유 작업 범용 worker.

python -m app.worker.stream.batch 로 독립 실행. realtime 워커(app.worker.stream, ai:jobs)와
별도 OS 프로세스로, ai:jobs:batch / batch-workers 만 소비한다. 긴 CPU/LLM 잡
(voucher 추출 등 비긴급/대용량)이 시간에 민감한 realtime 작업을 head-of-line
blocking 하지 않도록 격리.

job_type 으로 JOB_HANDLERS 의 executor 를 찾아 실행하므로 voucher 전용이 아니다 —
비긴급 잡은 batch 큐(get_batch_dispatcher)로 던지고 executor 를 JOB_HANDLERS 에 등록하면 된다.
단, batch worker 는 XAUTOCLAIM reclaim 으로 고착 메시지를 재배달하므로 executor 는
멱등이어야 한다.

realtime 워커와 같은 이미지, 다른 command 로 배포.
"""

import asyncio

from app.infrastructure.worker.common.streams import GROUP_BATCH, STREAM_KEY_BATCH
from app.worker.stream.runner import run_worker

# 최장 batch 잡(voucher ~3분)보다 크게 — 진행 중 잡의 self-reclaim 방지, 고착만 회수
BATCH_RECLAIM_MIN_IDLE_MS = 600_000


async def main() -> None:
    await run_worker(
        label="Batch Worker",
        consumer_name="batch-1",
        stream_key=STREAM_KEY_BATCH,
        group_name=GROUP_BATCH,
        reclaim_min_idle_ms=BATCH_RECLAIM_MIN_IDLE_MS,
    )


if __name__ == "__main__":
    asyncio.run(main())
