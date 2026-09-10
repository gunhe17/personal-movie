"""realtime AI 잡 워커 진입점 — python -m app.worker.stream (ai:jobs).

API 서버와 같은 이미지, 다른 command. batch는 python -m app.worker.stream.batch.
"""

import asyncio

from app.worker.stream.runner import run_worker


async def main() -> None:
    # reclaim 미사용(명시) — realtime STT는 비멱등(재실행=이중과금)이라 XAUTOCLAIM 재수거를 켜지 않는다
    await run_worker(label="AI Worker", reclaim_min_idle_ms=None)


if __name__ == "__main__":
    asyncio.run(main())
