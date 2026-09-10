"""add_subscription_payment_and_reserved_plan

Revision ID: 8f7987860a70
Revises: 1bb96269218f
Create Date: 2026-05-22 11:43:44.605773

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

# revision identifiers, used by Alembic.
revision: str = '8f7987860a70'
down_revision: Union[str, Sequence[str], None] = '1bb96269218f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    existing_columns = {c["name"] for c in inspector.get_columns("subscriptions")}

    # 1. Subscription 테이블에 다운그레이드 예약 필드 추가
    if "reserved_plan" not in existing_columns:
        op.add_column('subscriptions', sa.Column(
            'reserved_plan', sa.String(length=20), nullable=True,
            comment='예약된 다운그레이드 플랜 (period_end 이후 적용)',
        ))
    if "reserved_at" not in existing_columns:
        op.add_column('subscriptions', sa.Column(
            'reserved_at', sa.DateTime(), nullable=True,
            comment='다운그레이드 예약 시각 (UTC)',
        ))

    # 2. SubscriptionPayment 테이블 생성
    if "subscription_payments" in inspector.get_table_names():
        return

    op.create_table(
        'subscription_payments',
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
        sa.Column('subscription_id', sa.String(length=36), nullable=False, comment='구독 ID'),
        sa.Column('plan', sa.String(length=20), nullable=False, comment='결제 대상 플랜'),
        sa.Column('amount', sa.Integer(), nullable=False, comment='결제 금액 (원)'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending',
                  comment='결제 상태 (pending, confirmed, failed, cancelled)'),
        sa.Column('toss_order_id', sa.String(length=64), nullable=False, comment='토스 주문 ID'),
        sa.Column('toss_payment_key', sa.String(length=200), nullable=True, comment='토스 paymentKey'),
        sa.Column('method', sa.String(length=30), nullable=True, comment='결제 수단'),
        sa.Column('paid_at', sa.DateTime(), nullable=True, comment='실제 결제 시각 (UTC)'),
        sa.Column('failed_reason', sa.Text(), nullable=True, comment='결제 실패 사유'),
        sa.Column('raw_response', sa.Text(), nullable=True, comment='토스 응답 JSON'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'),
                  comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()'),
                  comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index(
        'ix_subscription_payments_order_id',
        'subscription_payments', ['toss_order_id'],
        unique=True,
        postgresql_where='deleted_at IS NULL',
    )
    op.create_index(
        'ix_subscription_payments_center',
        'subscription_payments', ['center_id'],
        postgresql_where='deleted_at IS NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_subscription_payments_center', table_name='subscription_payments')
    op.drop_index('ix_subscription_payments_order_id', table_name='subscription_payments')
    op.drop_table('subscription_payments')
    op.drop_column('subscriptions', 'reserved_at')
    op.drop_column('subscriptions', 'reserved_plan')
