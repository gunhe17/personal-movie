"""구 배포 명령 호환 + 도메인 이벤트 소비 co-locate.

`python -m app.worker.batch`(기존 batch-worker command) 진입점 — 한 프로세스에서:
  - 리네임된 batch 스트림(app.worker.stream.batch)
  - 도메인 이벤트 반응(Track A: 알림·이메일) — 별도 컨테이너 없이 batch 인스턴스에 co-locate
둘 다 비긴급이라 realtime 워커(app.worker.stream)와의 격리는 유지된다.
"""

import asyncio


async def _main() -> None:
    # lazy: stream/event 소비 사슬을 import 시점에 안 끌어옴
    from app.worker.event.consumer import on_event_group
    from app.worker.event.runner import Work, build_worker
    from app.worker.event.sweeper import run_sweeper
    from app.worker.stream.batch import main as run_batch

    event_worker = build_worker()
    event_worker.work(Work(channel="event_group", handler=on_event_group))
    event_worker.sweeper(run_sweeper)

    # run_batch → run_worker 가 첫 await 전 setup_logging() 동기 실행 → event 소비보다 먼저 셋업.
    await asyncio.gather(run_batch(), event_worker.run())


if __name__ == "__main__":
    asyncio.run(_main())
