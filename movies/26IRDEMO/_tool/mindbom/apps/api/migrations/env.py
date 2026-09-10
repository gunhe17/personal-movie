"""Alembic 환경 설정 (Async SQLAlchemy 지원)"""
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.models import BaseModel
from app.core.config import settings

# 모든 모델 import (autogenerate 지원)
from app.modules.auth.account.models import Account  # noqa: F401
from app.modules.auth.token.models import RefreshToken  # noqa: F401
from app.modules.auth.password_reset.models import PasswordResetToken  # noqa: F401
from app.modules.institution.models import Institution  # noqa: F401
from app.modules.invitation.models import Invitation  # noqa: F401
from app.modules.member.models import Member  # noqa: F401
from app.modules.client.models import Client  # noqa: F401
from app.modules.examination.common.models import Examination, ExaminationBattery  # noqa: F401
from app.modules.examination.common.ai_job_models import AIAnalysisJob  # noqa: F401
from app.modules.examination.htp.models import HTPDrawing, HTPObject, HTPInterpretation  # noqa: F401
from app.modules.examination.rorschach.models import (  # noqa: F401
    RorschachSession,
    RorschachRegion,
    RorschachResponse,
)
from app.modules.audit.models import AuditLog  # noqa: F401
from app.modules.notification.models import Notification  # noqa: F401
from app.modules.comprehensive_report.models import (  # noqa: F401
    ComprehensiveReport,
    ComprehensiveReportExamination,
)

target_metadata = BaseModel.metadata

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
