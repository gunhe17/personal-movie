import asyncio

from app.core.logger import setup_logging
from app.worker.event.consumer import on_event_group
from app.worker.event.sweeper import run_sweeper
from app.worker.event.runner import Work, build_worker

worker = build_worker()
worker.work(Work(channel="event_group", handler=on_event_group))
worker.sweeper(run_sweeper)


if __name__ == "__main__":
    setup_logging()
    asyncio.run(worker.run())
