"""add activity_logs table

Revision ID: a5596491eb9a
Revises: a95740587a55
Create Date: 2026-02-24 21:55:25.238971

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a5596491eb9a'
down_revision: Union[str, Sequence[str], None] = 'a95740587a55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('activity_logs',
    sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
    sa.Column('actor_id', sa.String(length=36), nullable=False, comment='행위자 ID (member_id)'),
    sa.Column('actor_name', sa.String(length=100), nullable=True, comment='행위자 이름 (비정규화)'),
    sa.Column('category', sa.String(length=50), nullable=False, comment='대분류 (assessment_case, client 등)'),
    sa.Column('action', sa.String(length=30), nullable=False, comment='행위 (created, updated, deleted 등)'),
    sa.Column('entity_type', sa.String(length=50), nullable=False, comment='대상 엔티티 종류'),
    sa.Column('entity_id', sa.String(length=36), nullable=False, comment='대상 엔티티 ID'),
    sa.Column('summary', sa.Text(), nullable=False, comment='사람이 읽을 수 있는 요약'),
    sa.Column('ip_address', sa.String(length=45), nullable=True, comment='요청 IP (IPv6 호환)'),
    sa.Column('user_agent', sa.Text(), nullable=True, comment='브라우저 정보'),
    sa.Column('extra', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='변경 상세 (old/new 값 등)'),
    sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
    sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_activity_logs_actor', 'activity_logs', ['center_id', 'actor_id', 'created_at'], unique=False)
    op.create_index('ix_activity_logs_category_action', 'activity_logs', ['center_id', 'category', 'action'], unique=False)
    op.create_index('ix_activity_logs_center_created', 'activity_logs', ['center_id', 'created_at'], unique=False)
    op.create_index('ix_activity_logs_entity', 'activity_logs', ['entity_type', 'entity_id', 'created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_activity_logs_entity', table_name='activity_logs')
    op.drop_index('ix_activity_logs_center_created', table_name='activity_logs')
    op.drop_index('ix_activity_logs_category_action', table_name='activity_logs')
    op.drop_index('ix_activity_logs_actor', table_name='activity_logs')
    op.drop_table('activity_logs')
