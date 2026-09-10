from typing import Any, Awaitable, Callable

from fastapi import BackgroundTasks

# 조립 루트가 주입하는 job runner(application dispatch_job) — infra는 슬롯만 소유(IoC).
# embedded는 큐가 없어 dispatch가 실행까지 겸하나, resolve는 application 엔진에 위임한다.
_run_job: Callable[..., Awaitable[None]] | None = None


def set_job_runner(fn: Callable[..., Awaitable[None]]) -> None:
    global _run_job
    _run_job = fn


class EmbeddedDispatcher:
    def __init__(self, background_tasks: BackgroundTasks):
        self._bg = background_tasks

    async def dispatch(
        self,
        job_type: str,
        *,
        target_id: str,
        center_id: str,
        params: dict[str, Any] | None = None,
    ) -> None:
        if _run_job is None:
            raise RuntimeError(
                "job runner not registered — call set_job_runner at startup"
            )
        self._bg.add_task(
            _run_job,
            job_type=job_type,
            target_id=target_id,
            center_id=center_id,
            params=params or {},
        )
