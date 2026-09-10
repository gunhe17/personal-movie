"""add platform_settings and plan_configs tables

Revision ID: 7794f9e2258b
Revises: c7d1f0a3b921
Create Date: 2026-06-04 13:40:14.342866

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7794f9e2258b'
down_revision: Union[str, Sequence[str], None] = 'c7d1f0a3b921'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. 테이블 생성
    op.create_table('platform_settings',
        sa.Column('key', sa.String(length=100), nullable=False, comment='설정 키'),
        sa.Column('value', sa.Text(), nullable=False, comment='설정 값 (문자열)'),
        sa.Column('description', sa.String(length=500), nullable=True, comment='설정 설명'),
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )

    op.create_table('plan_configs',
        sa.Column('plan_type', sa.String(length=30), nullable=False, comment='플랜 타입 (free/starter/pro/enterprise)'),
        sa.Column('label', sa.String(length=50), nullable=False, comment='플랜 표시명'),
        sa.Column('price_monthly', sa.Integer(), nullable=False, comment='월 가격 (원)'),
        sa.Column('credit_limit', sa.Integer(), nullable=False, comment='AI 크레딧 한도'),
        sa.Column('features', sa.Text(), nullable=False, comment='기능 플래그 (JSON array)'),
        sa.Column('plan_order', sa.Integer(), nullable=False, comment='플랜 순서 (업/다운그레이드 판단)'),
        sa.Column('is_active', sa.Boolean(), nullable=False, comment='활성 여부'),
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_type'),
    )

    # 2. 시스템 설정 시드 데이터
    settings_table = sa.table(
        'platform_settings',
        sa.column('id', sa.String),
        sa.column('key', sa.String),
        sa.column('value', sa.Text),
        sa.column('description', sa.String),
    )
    op.bulk_insert(settings_table, [
        {'id': str(uuid4()), 'key': 'trial_duration_days', 'value': '365', 'description': '체험 기본 기간 (일)'},
        {'id': str(uuid4()), 'key': 'trial_plan', 'value': 'pro', 'description': '체험 시 부여 플랜'},
        {'id': str(uuid4()), 'key': 'credit_cycle_days', 'value': '30', 'description': '크레딧 갱신 주기 (일)'},
        {'id': str(uuid4()), 'key': 'quota_grace_days', 'value': '7', 'description': '쿼터 초과 유예 기간 (일)'},
    ])

    # 3. 플랜 설정 시드 데이터
    plans_table = sa.table(
        'plan_configs',
        sa.column('id', sa.String),
        sa.column('plan_type', sa.String),
        sa.column('label', sa.String),
        sa.column('price_monthly', sa.Integer),
        sa.column('credit_limit', sa.Integer),
        sa.column('features', sa.Text),
        sa.column('plan_order', sa.Integer),
        sa.column('is_active', sa.Boolean),
    )
    op.bulk_insert(plans_table, [
        {
            'id': str(uuid4()), 'plan_type': 'free', 'label': 'Free',
            'price_monthly': 0, 'credit_limit': 0, 'features': '[]',
            'plan_order': 0, 'is_active': True,
        },
        {
            'id': str(uuid4()), 'plan_type': 'starter', 'label': 'Starter',
            'price_monthly': 29000, 'credit_limit': 600,
            'features': '["ai_field_note"]',
            'plan_order': 1, 'is_active': True,
        },
        {
            'id': str(uuid4()), 'plan_type': 'pro', 'label': 'Pro',
            'price_monthly': 59000, 'credit_limit': 2500,
            'features': '["ai_field_note", "ai_agent", "ai_case_analysis"]',
            'plan_order': 2, 'is_active': True,
        },
        {
            'id': str(uuid4()), 'plan_type': 'enterprise', 'label': 'Enterprise',
            'price_monthly': 0, 'credit_limit': 8000,
            'features': '["ai_field_note", "ai_agent", "ai_case_analysis", "api_access"]',
            'plan_order': 3, 'is_active': True,
        },
    ])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('plan_configs')
    op.drop_table('platform_settings')
