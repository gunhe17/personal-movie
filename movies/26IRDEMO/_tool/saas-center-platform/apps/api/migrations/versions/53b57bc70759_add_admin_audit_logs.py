"""add admin_audit_logs

Revision ID: 53b57bc70759
Revises: d78425ebd687
Create Date: 2026-03-10 14:22:52.444354

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '53b57bc70759'
down_revision: Union[str, Sequence[str], None] = 'd78425ebd687'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    admin_audit_logs 테이블은 이미 생성되어 있음 (이전 세션에서 직접 생성).
    inquiries/faqs 테이블은 platform_admin/qna 모듈에서 계속 사용 중이므로 유지.
    """
    # admin_audit_logs 테이블이 없는 경우에만 생성 (멱등성 보장)
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='admin_audit_logs'")
    )
    if not result.fetchone():
        op.create_table(
            'admin_audit_logs',
            sa.Column('admin_account_id', sa.String(36), nullable=False, comment='행위자 어드민 ID'),
            sa.Column('admin_email', sa.String(200), nullable=False, comment='행위자 이메일 (비정규화)'),
            sa.Column('action', sa.String(100), nullable=False, comment='행위 (예: center_application.approved)'),
            sa.Column('target_type', sa.String(50), nullable=False, comment='대상 타입 (예: center_application)'),
            sa.Column('target_id', sa.String(36), nullable=False, comment='대상 UUID'),
            sa.Column('summary', sa.Text, nullable=False, comment='사람이 읽을 수 있는 한국어 요약'),
            sa.Column('ip_address', sa.String(45), nullable=True, comment='요청 IP (IPv6 호환)'),
            sa.Column('extra', postgresql.JSONB(), nullable=True, comment='변경 상세 (Phase 2)'),
            sa.Column('id', sa.String(36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', postgresql.TIMESTAMP(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', postgresql.TIMESTAMP(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_admin_audit_logs_admin_created', 'admin_audit_logs', ['admin_account_id', 'created_at'])
        op.create_index('ix_admin_audit_logs_action_created', 'admin_audit_logs', ['action', 'created_at'])
        op.create_index('ix_admin_audit_logs_target', 'admin_audit_logs', ['target_type', 'target_id', 'created_at'])


def downgrade() -> None:
    """Downgrade schema."""
    pass
