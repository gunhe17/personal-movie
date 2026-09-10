"""Redis Stream 워커 드라이버 — realtime(__main__)·batch가 공유.

Redis 연결·시그널 핸들링·graceful shutdown은 동일하고,
소비할 stream/group·reclaim 정책만 다르다(consumer kwargs).
"""

import asyncio
import signal

from app.core.config import settings
from app.core.logger import get_logger, setup_logging
from app.worker.stream.connection import redis_client
from app.worker.stream.consumer import WorkerConsumer

logger = get_logger(__name__)


async def run_worker(*, label: str, **consumer_kwargs) -> None:
    setup_logging()
    logger.info("%s starting...", label)

    if not settings.REDIS_URL:
        logger.error("REDIS_URL is not set. %s cannot start.", label)
        return

    redis = redis_client()

    try:
        await redis.ping()
        logger.info("Redis connected: %s", settings.REDIS_URL.split("@")[-1])
    except Exception as e:
        logger.error("Redis connection failed: %s", e)
        await redis.aclose()
        return

    consumer = WorkerConsumer(redis, **consumer_kwargs)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, consumer.stop)

    try:
        await consumer.run()
    finally:
        await redis.aclose()
        logger.info("%s shutdown complete", label)
