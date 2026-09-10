"""add client_favorites table

Revision ID: e7a2c4f9b1d3
Revises: d8e5b3a9c2f4
Create Date: 2026-05-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a2c4f9b1d3'
down_revision: Union[str, Sequence[str], None] = 'd8e5b3a9c2f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema (idempotent — 이미 존재하는 환경에서도 안전).

    Note:
        이전 적용 중 부분 실패 또는 수동 생성으로 테이블이 이미 존재할 수 있어
        DuplicateTableError가 발생할 수 있다. inspector로 존재 여부 확인 후
        조건부 생성으로 변경.
    """
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'client_favorites' not in existing_tables:
        op.create_table(
            'client_favorites',
            sa.Column('person_id', sa.String(length=36), nullable=False, comment='관심 표시한 상담사의 Person UUID'),
            sa.Column('client_id', sa.String(length=36), nullable=False, comment='관심 표시된 내담자 Client UUID'),
            sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID (UUID)'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('person_id', 'client_id', name='uq_client_favorites_person_client'),
        )

    # 인덱스도 보장 — 테이블만 있고 인덱스 없는 케이스 대비
    existing_indexes = (
        [idx['name'] for idx in inspector.get_indexes('client_favorites')]
        if 'client_favorites' in inspector.get_table_names()
        else []
    )
    if 'ix_client_favorites_person_center' not in existing_indexes:
        op.create_index(
            'ix_client_favorites_person_center',
            'client_favorites',
            ['person_id', 'center_id'],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema (idempotent)."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'client_favorites' in inspector.get_table_names():
        existing_indexes = [idx['name'] for idx in inspector.get_indexes('client_favorites')]
        if 'ix_client_favorites_person_center' in existing_indexes:
            op.drop_index('ix_client_favorites_person_center', table_name='client_favorites')
        op.drop_table('client_favorites')
