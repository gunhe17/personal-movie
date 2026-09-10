"""add_message_templates_table

Revision ID: 3c0a48bd95a0
Revises: c1a2b3d4e5f6
Create Date: 2026-03-26 12:50:48.141038

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3c0a48bd95a0'
down_revision: Union[str, Sequence[str], None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """테이블 존재 여부 확인"""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :name)"
        ),
        {"name": table_name},
    )
    return result.scalar()


def upgrade() -> None:
    """Upgrade schema."""
    if not _table_exists("message_templates"):
        op.create_table(
            'message_templates',
            sa.Column('center_id', sa.String(length=36), nullable=True, comment='센터 UUID (NULL=시스템 기본)'),
            sa.Column('template_type', sa.String(length=50), nullable=False, comment='양식 타입 (assessment_result_send 등)'),
            sa.Column('name', sa.String(length=100), nullable=False, comment='양식 이름'),
            sa.Column('content', sa.Text(), nullable=False, comment='양식 본문 ({center_name} 등 변수 포함)'),
            sa.Column('variables', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='변수 정의 [{"key": "center_name", "label": "센터명", "required": true}]'),
            sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='기본 양식 여부'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(timezone=False), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_message_templates_center_id', 'message_templates', ['center_id'])
        op.create_index('idx_msg_tpl_center_type', 'message_templates', ['center_id', 'template_type'])
        op.create_index(
            'uq_msg_tpl_center_type_default',
            'message_templates',
            ['center_id', 'template_type'],
            unique=True,
            postgresql_where=sa.text('is_default = true AND deleted_at IS NULL'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    if _table_exists("message_templates"):
        op.drop_index('uq_msg_tpl_center_type_default', table_name='message_templates')
        op.drop_index('idx_msg_tpl_center_type', table_name='message_templates')
        op.drop_index('ix_message_templates_center_id', table_name='message_templates')
        op.drop_table('message_templates')
