import asyncio
import signal
from typing import Awaitable, Callable

from app.core.logger import get_logger
from app.worker.event.connection import Connection, notification_connection

logger = get_logger(__name__)

Handler = Callable[[str], Awaitable[None]]


class Pool:
    def __init__(self, size: int):
        self._semaphore = asyncio.Semaphore(size)
        self._in_progress: set[asyncio.Task] = set()

    def submit(self, coro: Awaitable[None]) -> None:
        task = asyncio.create_task(self._bounded(coro))
        self._in_progress.add(task)
        task.add_done_callback(self._in_progress.discard)

    async def wait(self) -> None:
        if self._in_progress:
            await asyncio.gather(*self._in_progress, return_exceptions=True)

    async def _bounded(self, coro: Awaitable[None]) -> None:
        async with self._semaphore:
            await coro


class Lifecycle:
    def __init__(self):
        self._stop = asyncio.Event()

    async def wait(self) -> None:
        loop = asyncio.get_running_loop()
        for s in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(s, self._stop.set)
        await self._stop.wait()


class Work:
    def __init__(self, *, channel: str, handler: Handler):
        self._channel = channel
        self._handler = handler

    async def register(self, *, connection: Connection, pool: Pool) -> None:
        async def _run(payload: str) -> None:
            try:
                await self._handler(payload)
            except Exception as error:
                logger.error("work '%s' failed: %s", self._channel, error)

        def _on_notify(conn, pid, channel, payload):
            pool.submit(_run(payload))

        await connection.listen(channel=self._channel, callback=_on_notify)


class Worker:
    def __init__(self, *, name: str, concurrency: int = 16):
        self._name = name
        self._concurrency = concurrency
        self._works: list[Work] = []
        self._sweeper = None

    def work(self, work: Work) -> None:
        self._works.append(work)

    def sweeper(self, coro_factory: Callable[[], Awaitable[None]]) -> None:
        self._sweeper = coro_factory

    async def run(self) -> None:
        pool = Pool(self._concurrency)
        lifecycle = Lifecycle()

        connection = await notification_connection()
        for work in self._works:
            await work.register(connection=connection, pool=pool)
        sweeper_task = asyncio.create_task(self._sweeper()) if self._sweeper is not None else None

        logger.info("event worker '%s' running (concurrency=%d)", self._name, self._concurrency)
        await lifecycle.wait()

        if sweeper_task is not None:
            sweeper_task.cancel()
        await connection.close()
        await pool.wait()


def build_worker() -> Worker:
    return Worker(name="saas-center-event-worker", concurrency=16)
