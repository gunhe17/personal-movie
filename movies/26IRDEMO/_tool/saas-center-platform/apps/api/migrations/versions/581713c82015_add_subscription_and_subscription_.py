"""add subscription and subscription_history tables

Revision ID: 581713c82015
Revises: a2590d773987
Create Date: 2026-04-23 14:09:23.905273

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '581713c82015'
down_revision: Union[str, Sequence[str], None] = 'a2590d773987'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """subscriptions + subscription_history 테이블 생성 + 기존 센터 데이터 마이그레이션."""

    # 1. subscriptions 테이블 (이미 존재할 수 있으므로 raw DDL 사용)
    op.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITHOUT TIME ZONE,
            center_id VARCHAR(36) NOT NULL,
            plan VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL,
            current_period_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            current_period_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            trial_end TIMESTAMP WITHOUT TIME ZONE,
            cancelled_at TIMESTAMP WITHOUT TIME ZONE,
            is_quota_exceeded BOOLEAN DEFAULT false NOT NULL,
            quota_grace_end TIMESTAMP WITHOUT TIME ZONE
        )
    """)

    # Partial unique index
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_subscriptions_center_active
        ON subscriptions (center_id)
        WHERE deleted_at IS NULL
    """)

    # 2. subscription_history 테이블
    op.execute("""
        CREATE TABLE IF NOT EXISTS subscription_history (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            deleted_at TIMESTAMP WITHOUT TIME ZONE,
            subscription_id VARCHAR(36) NOT NULL,
            from_plan VARCHAR(20),
            to_plan VARCHAR(20) NOT NULL,
            changed_by VARCHAR(20) NOT NULL,
            reason VARCHAR(100) NOT NULL,
            changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_subscription_history_sub_id
        ON subscription_history (subscription_id)
    """)

    # 3. 기존 센터에 Free 구독 데이터 마이그레이션
    op.execute("""
        INSERT INTO subscriptions (id, center_id, plan, status, current_period_start, current_period_end, is_quota_exceeded, created_at, updated_at)
        SELECT
            gen_random_uuid()::varchar(36),
            c.id,
            'free',
            'active',
            now(),
            now() + interval '100 years',
            false,
            now(),
            now()
        FROM centers c
        WHERE c.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM subscriptions s
              WHERE s.center_id = c.id AND s.deleted_at IS NULL
          )
    """)


def downgrade() -> None:
    """subscriptions + subscription_history 테이블 삭제."""
    op.execute("DROP INDEX IF EXISTS ix_subscription_history_sub_id")
    op.execute("DROP TABLE IF EXISTS subscription_history")
    op.execute("DROP INDEX IF EXISTS ix_subscriptions_center_active")
    op.execute("DROP TABLE IF EXISTS subscriptions")
