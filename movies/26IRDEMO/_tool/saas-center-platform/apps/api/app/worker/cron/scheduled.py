"""Scheduled job 정의 + 등록.

각 잡은 application handler를 use_cron_action(behavior)으로 감싼 얇은 래퍼다 —
tx는 transactional_uow가 소유하고, advisory xact lock으로 멀티 레플리카 중 1개만 실행하며,
외부 채널(알림톡/SMS) 발송은 트랜잭션 커밋 뒤에 한다.
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import TYPE_CHECKING

from app.application.handlers.notification.send_schedule_reminders import (
    send_schedule_reminders_handler,
)
from app.application.handlers.notification.send_client_schedule_reminders import (
    send_client_schedule_reminders_handler,
)
from app.application.handlers.subscription.apply_expired_downgrades import (
    apply_expired_downgrades_handler,
)
from app.application.handlers.assistant.sweep_assistant import sweep_assistant_handler
from app.application.handlers.voucher.sweep_voucher_batches import (
    sweep_voucher_batches_handler,
)
from app.behavior.worker import use_cron_action
from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.modules.notification.helpers import (
    dispatch_single_notification,
    send_sms_to_client,
)

if TYPE_CHECKING:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = get_logger(__name__)


# advisory xact lock 키 — 잡마다 고유 int64. 값을 바꾸면 락 상태가 리셋된다.
_LOCK_KEY_SCHEDULE_REMINDERS = 735_120_001
_LOCK_KEY_CLIENT_SMS_REMINDERS = 735_120_002
_LOCK_KEY_EXPIRED_DOWNGRADES = 735_120_003
_LOCK_KEY_ASSISTANT_SWEEP = 735_120_004
_LOCK_KEY_VOUCHER_BATCH_SWEEP = 735_120_005


async def send_schedule_reminders_job() -> None:
    # 조회창 [now+24h, now+25h) — 각 일정은 (시작-24h)가 든 cron 시간에 정확히 한 번 알림
    targets = None
    async with use_cron_action(
        lock_key=_LOCK_KEY_SCHEDULE_REMINDERS,
        name="schedule_reminders_job",
    ) as scope:
        if scope is None:
            return
        now = utc_now()
        targets = await send_schedule_reminders_handler(
            uow=scope.uow,
            start_utc=now + timedelta(hours=24),
            end_utc=now + timedelta(hours=25),
            lead_label="24h",
        )
    if targets:
        for target in targets:
            asyncio.create_task(dispatch_single_notification(target))
        logger.info(
            "schedule_reminders_job: dispatched %d external channel notifications",
            len(targets),
        )


async def send_client_sms_reminders_job() -> None:
    # 조회창 = 내일 00:00~23:59:59 KST (UTC naive 변환)
    from datetime import timezone

    from app.core.datetime_utils import KST

    targets = None
    async with use_cron_action(
        lock_key=_LOCK_KEY_CLIENT_SMS_REMINDERS,
        name="client_sms_reminders_job",
    ) as scope:
        if scope is None:
            return
        now_kst = utc_now().replace(tzinfo=timezone.utc).astimezone(KST)
        tomorrow_kst = (now_kst + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        tomorrow_end_kst = tomorrow_kst.replace(hour=23, minute=59, second=59)
        targets = await send_client_schedule_reminders_handler(
            uow=scope.uow,
            start_utc=tomorrow_kst.astimezone(timezone.utc).replace(tzinfo=None),
            end_utc=tomorrow_end_kst.astimezone(timezone.utc).replace(tzinfo=None),
        )
    if targets:
        for target in targets:
            asyncio.create_task(send_sms_to_client(target))
        logger.info(
            "client_sms_reminders_job: dispatched %d client reminder SMS", len(targets)
        )


async def apply_expired_downgrades_job() -> None:
    # reserved_plan 있고 period_end 지남 → reserved plan 전환 + 크레딧 리셋
    # 예약 없이 period_end 지난 유료 구독 → 만료 처리
    async with use_cron_action(
        lock_key=_LOCK_KEY_EXPIRED_DOWNGRADES,
        name="expired_downgrades_job",
    ) as scope:
        if scope is None:
            return
        assert scope.event_group_id is not None
        result = await apply_expired_downgrades_handler(
            uow=scope.uow,
            event_group_id=scope.event_group_id,
        )
        logger.info(
            "expired_downgrades_job: processed %d subscriptions",
            result["processed"],
        )


async def assistant_sweep_job() -> None:
    # 프로세스 즉사 잔재(stale running 턴)·방치 빈 대화 정리 — 터미널 flush의 backstop
    async with use_cron_action(
        lock_key=_LOCK_KEY_ASSISTANT_SWEEP,
        name="assistant_sweep_job",
    ) as scope:
        if scope is None:
            return
        await sweep_assistant_handler(uow=scope.uow)


async def voucher_batch_sweep_job() -> None:
    async with use_cron_action(
        lock_key=_LOCK_KEY_VOUCHER_BATCH_SWEEP,
        name="voucher_batch_sweep_job",
    ) as scope:
        if scope is None:
            return
        await sweep_voucher_batches_handler(uow=scope.uow)


def register_jobs(scheduler: "AsyncIOScheduler") -> None:
    """Called once at startup from scheduler.factory get_scheduler().start()."""
    from apscheduler.triggers.cron import CronTrigger

    # 상담사 리마인드 (매시간 정각, 24시간 전)
    scheduler.add_job(
        send_schedule_reminders_job,
        trigger=CronTrigger(minute=0),  # every hour at :00
        id="schedule_reminders",
        name="Schedule reminder notifications (24h before start)",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    logger.info(
        "Registered scheduler job: schedule_reminders (cron: every hour at :00)"
    )

    # 내담자 SMS 리마인드 (매일 오전 9시 KST = UTC 00:00)
    scheduler.add_job(
        send_client_sms_reminders_job,
        trigger=CronTrigger(hour=0, minute=0),  # UTC 00:00 = KST 09:00
        id="client_sms_reminders",
        name="Client SMS reminder (daily 09:00 KST, tomorrow schedules)",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    logger.info(
        "Registered scheduler job: client_sms_reminders (cron: daily UTC 00:00 = KST 09:00)"
    )

    # 만료 구독 자동 전환 (매시간 30분)
    scheduler.add_job(
        apply_expired_downgrades_job,
        trigger=CronTrigger(minute=30),  # every hour at :30
        id="expired_downgrades",
        name="Apply expired downgrades and expire unpaid subscriptions",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    logger.info(
        "Registered scheduler job: expired_downgrades (cron: every hour at :30)"
    )

    # assistant 잔재 정리 (매시간 45분)
    scheduler.add_job(
        assistant_sweep_job,
        trigger=CronTrigger(minute=45),  # every hour at :45
        id="assistant_sweep",
        name="Sweep stale running assistant turns and empty conversations",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    logger.info("Registered scheduler job: assistant_sweep (cron: every hour at :45)")

    # 바우처 배치 안전망 — 조회-트리거를 아무도 안 부를 때만 대신 훑는다 (매 20분)
    scheduler.add_job(
        voucher_batch_sweep_job,
        trigger=CronTrigger(minute="*/20"),
        id="voucher_batch_sweep",
        name="Sweep voucher extractions waiting on a Gemini batch job",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    logger.info("Registered scheduler job: voucher_batch_sweep (cron: every 20 minutes)")
