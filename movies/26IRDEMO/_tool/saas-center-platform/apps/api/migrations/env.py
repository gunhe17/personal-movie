"""Alembic 환경 설정 (Async SQLAlchemy 지원)"""
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Alembic Config 객체
config = context.config

# Python logging 설정
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 애플리케이션 모듈 import (autogenerate 지원)
import sys
from pathlib import Path

# apps/api를 sys.path에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.infrastructure.persistence.models import BaseModel
from app.core.config import settings

from app.modules import models  # noqa: F401

# MetaData 설정 (autogenerate를 위해 필수)
target_metadata = BaseModel.metadata

# DATABASE_URL을 config에 설정 (alembic.ini보다 우선)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """
    Offline 모드로 마이그레이션 실행

    DB 연결 없이 SQL 스크립트만 생성
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,  # 컬럼 타입 변경 감지
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """실제 마이그레이션 실행 함수"""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,  # 컬럼 타입 변경 감지
        compare_server_default=True,  # 기본값 변경 감지
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Async 엔진으로 마이그레이션 실행"""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """
    Online 모드로 마이그레이션 실행

    Async SQLAlchemy를 사용하여 실제 DB 연결
    """
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
