from fastapi import FastAPI

from app.core.config import settings
from app.core.logger import setup_logging, get_logger
from app.behavior.action.event import Event, EventGroupContext
from app.infrastructure.persistence.database import AsyncSessionLocal, close_db
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

logger = get_logger(__name__)


async def init_db() -> None:
    # 프로덕션은 Alembic 권장 — 여기 create_all은 개발 DB용
    from app.infrastructure.persistence.database import engine
    from app.infrastructure.persistence.models import BaseModel
    from app.modules import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)


# #
# startup

async def start_logging(app: FastAPI) -> None:
    setup_logging()

    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"📝 Environment: {settings.APP_ENV}")
    logger.info(f"🔍 Debug Mode: {settings.DEBUG}")


async def create_schema(app: FastAPI) -> None:
    logger.info("📦 Initializing database tables...")
    await init_db()
    logger.info("✅ Database tables ready")


async def seed_system_templates(app: FastAPI) -> None:
    from app.modules.messaging.message_template.repository import (
        MessageTemplateRepository,
    )
    from app.modules.messaging.message_template.services.initialize_system_templates import (
        InitializeSystemTemplatesService,
    )

    seed_event_group_id = (await EventGroupContext.setup()).event_group_id
    async with AsyncSessionLocal() as session:
        atomics, _ = await InitializeSystemTemplatesService(
            MessageTemplateRepository(session)
        ).execute()
        await emit(
            UnitOfWork(session),
            "system_message_templates_initialized",
            event_group_id=seed_event_group_id,
            atomics=atomics,
            actor_type="machine",
        )
        await session.commit()
    await Event.dispatch_event(seed_event_group_id)


async def load_plan_config_cache(app: FastAPI) -> None:
    from app.modules.subscription.subscription.plan_config import (
        refresh_plan_config_cache,
    )

    async with AsyncSessionLocal() as session:
        await refresh_plan_config_cache(session)
    logger.info("✅ Plan config cache loaded")


async def open_cache_client(app: FastAPI) -> None:
    from app.infrastructure.cache.factory import get_cache_client

    app.state.cache_client = await get_cache_client()


async def wire_job_runner(app: FastAPI) -> None:
    # EmbeddedDispatcher가 application dispatch_job으로 실행하도록 주입(IoC)
    from functools import partial

    from app.application.jobs.dispatch import dispatch_job
    from app.application.jobs.routes import JOB_HANDLERS
    from app.infrastructure.worker.embedded.client import set_job_runner

    set_job_runner(partial(dispatch_job, table=JOB_HANDLERS))


async def start_scheduler(app: FastAPI) -> None:
    # 잡 정의는 app/application/jobs(L3)에 있고, 여기서 infra 스케줄러에 주입한다.
    # settings.ENABLE_SCHEDULER=False 면 no-op
    try:
        from app.infrastructure.scheduler.factory import get_scheduler
        from app.worker.cron.scheduled import register_jobs

        get_scheduler().start(register_jobs=register_jobs)
    except Exception:
        logger.error("❌ Scheduler initialization failed", exc_info=True)


# #
# shutdown

async def stop_scheduler(app: FastAPI) -> None:
    logger.info("🛑 Shutting down...")
    try:
        from app.infrastructure.scheduler.factory import get_scheduler

        get_scheduler().stop()
    except Exception:
        logger.error("Scheduler shutdown failed", exc_info=True)


async def close_cache_client(app: FastAPI) -> None:
    from app.infrastructure.cache.redis.manager import redis_manager

    await redis_manager.close()


async def close_database(app: FastAPI) -> None:
    await close_db()
    logger.info("✅ Cleanup complete")
