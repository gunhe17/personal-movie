import asyncio
import time

import redis.asyncio as aioredis

from app.application.jobs.dispatch import dispatch_job
from app.application.jobs.routes import JOB_HANDLERS
from app.core.logger import get_logger
from app.infrastructure.worker.common.schemas import JobMessage

logger = get_logger(__name__)

STREAM_KEY = "ai:jobs"
GROUP_NAME = "ai-workers"
BLOCK_MS = 5000


class WorkerConsumer:
    """Redis Stream Consumer Group 기반 작업 소비자.

    XREADGROUP으로 메시지를 읽고, job_type에 매핑된 executor를 실행.
    성공/실패 모두 XACK 처리 (DB 상태가 이미 파이프라인 내에서 업데이트됨).
    """

    def __init__(
        self,
        redis: aioredis.Redis,
        consumer_name: str = "worker-1",
        *,
        stream_key: str = STREAM_KEY,
        group_name: str = GROUP_NAME,
        reclaim_min_idle_ms: int | None = None,
        table: dict | None = None,
    ):
        # stream/group 을 인스턴스 단위로 — 같은 클래스로 field_note(ai:jobs)와
        # batch(ai:jobs:batch) 워커를 각각 띄운다. 기본값=기존값이라
        # field_note 워커 동작은 불변.
        #
        # reclaim_min_idle_ms: 설정 시 XAUTOCLAIM 으로 PEL 고착 메시지를 회수.
        #   voucher 전용(executor 가 멱등)으로만 켠다. field_note 는 None —
        #   비멱등 파이프라인이라 재배달 시 중복 STT/요약 + 이중과금 위험.
        self._redis = redis
        self._consumer_name = consumer_name
        self._stream_key = stream_key
        self._group_name = group_name
        self._reclaim_min_idle_ms = reclaim_min_idle_ms
        self._table = table if table is not None else JOB_HANDLERS
        self._running = False

    async def _ensure_group(self) -> None:
        """Consumer Group 생성 (이미 존재하면 무시)."""
        try:
            await self._redis.xgroup_create(
                self._stream_key, self._group_name, id="0", mkstream=True,
            )
            logger.info("Consumer group created: %s", self._group_name)
        except aioredis.ResponseError as e:
            if "BUSYGROUP" in str(e):
                logger.debug(
                    "Consumer group already exists: %s", self._group_name
                )
            else:
                raise

    async def run(self) -> None:
        await self._ensure_group()
        self._running = True
        logger.info(
            "Worker consumer started: stream=%s group=%s consumer=%s",
            self._stream_key, self._group_name, self._consumer_name,
        )

        while self._running:
            try:
                # reclaim — PEL 고착 메시지 회수 (voucher 전용, 켜진 경우만)
                if self._reclaim_min_idle_ms is not None:
                    await self._reclaim()

                messages = await self._redis.xreadgroup(
                    self._group_name,
                    self._consumer_name,
                    {self._stream_key: ">"},
                    count=1,
                    block=BLOCK_MS,
                )

                if not messages:
                    continue

                for _stream, entries in messages:
                    for msg_id, data in entries:
                        await self._process_message(msg_id, data)

            except asyncio.CancelledError:
                logger.info("Worker consumer cancelled")
                break
            except Exception:
                logger.error("Consumer loop error, retrying in 3s", exc_info=True)
                await asyncio.sleep(3)

        logger.info("Worker consumer stopped")

    async def _reclaim(self) -> None:
        """min_idle 초과로 PEL 에 고착된 메시지를 회수해 재처리.

        크래시(XACK 전 종료)로 PEL 에 남은 메시지를 다른(또는 재기동한) consumer 가
        다시 가져온다. min_idle 은 최장 잡보다 크게 잡아 진행 중 잡의 self-reclaim 을
        막는다(직렬 루프라 처리 중엔 sweep 안 함). 재처리 안전성은 executor 멱등성에 의존.
        """
        try:
            cursor = "0-0"
            while True:
                result = await self._redis.xautoclaim(
                    self._stream_key,
                    self._group_name,
                    self._consumer_name,
                    min_idle_time=self._reclaim_min_idle_ms,
                    start_id=cursor,
                    count=10,
                )
                next_cursor, claimed = result[0], result[1]
                for msg_id, data in claimed:
                    logger.warning(
                        "Reclaiming stuck message: stream=%s id=%s",
                        self._stream_key, msg_id,
                    )
                    await self._process_message(msg_id, data)
                # 다음 배치 없음 → 종료. stop() 호출 시 배치 간 continuation 중단.
                if not claimed or next_cursor in ("0-0", b"0-0"):
                    break
                if not self._running:
                    break
                cursor = next_cursor
        except Exception:
            logger.error("Reclaim sweep error", exc_info=True)

    async def _process_message(self, msg_id: str, data: dict) -> None:
        job = JobMessage.from_redis(data)
        start = time.monotonic()
        logger.info(
            "Processing job: id=%s type=%s field_note=%s",
            job.job_id, job.job_type, job.target_id[:8],
        )

        try:
            await dispatch_job(
                job_type=job.job_type,
                target_id=job.target_id,
                center_id=job.center_id,
                params=job.params,
                table=self._table,
            )

            elapsed = time.monotonic() - start
            logger.info(
                "Job completed: id=%s type=%s elapsed=%.1fs",
                job.job_id, job.job_type, elapsed,
            )

        except Exception as e:
            elapsed = time.monotonic() - start
            logger.error(
                "Job failed: id=%s type=%s elapsed=%.1fs error=%s",
                job.job_id, job.job_type, elapsed, e,
                exc_info=True,
            )

        # 성공/실패 모두 XACK — DB 상태가 authoritative.
        # 인스턴스 stream/group 으로 ack(모듈상수 아님) — voucher 워커가 자기
        # stream 에만 ack 하도록 보장(field_note 그룹 오염 방지).
        await self._redis.xack(self._stream_key, self._group_name, msg_id)

    def stop(self) -> None:
        self._running = False
