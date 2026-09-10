"""add directory_centers table

Revision ID: a4c1d27e9b53
Revises: 767c5970e78a
Create Date: 2026-08-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4c1d27e9b53'
down_revision: Union[str, Sequence[str], None] = '767c5970e78a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema (idempotent — 이미 존재하는 환경에서도 안전)."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'directory_centers' not in inspector.get_table_names():
        op.create_table(
            'directory_centers',
            sa.Column('source_id', sa.Integer(), nullable=False, comment='외부 디렉토리 CSV의 행 id (멱등 재임포트 자연키)'),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('address', sa.Text(), nullable=False),
            sa.Column('latitude', sa.Float(), nullable=False),
            sa.Column('longitude', sa.Float(), nullable=False),
            sa.Column('category', sa.String(length=20), nullable=False, comment='외부 정의 분류 (센터·복지기관·기타·병원 …)'),
            sa.Column('phone_number', sa.String(length=30), nullable=True),
            sa.Column('operating_hours_text', sa.Text(), nullable=True),
            sa.Column('website_url', sa.Text(), nullable=True),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )

    existing_indexes = (
        [idx['name'] for idx in inspector.get_indexes('directory_centers')]
        if 'directory_centers' in inspector.get_table_names()
        else []
    )
    if 'uq_directory_centers_source_id_active' not in existing_indexes:
        op.create_index(
            'uq_directory_centers_source_id_active',
            'directory_centers',
            ['source_id'],
            unique=True,
            postgresql_where=sa.text('deleted_at IS NULL'),
        )
    if 'ix_directory_centers_lat_lng' not in existing_indexes:
        op.create_index(
            'ix_directory_centers_lat_lng',
            'directory_centers',
            ['latitude', 'longitude'],
            unique=False,
        )


def downgrade() -> None:
    """Downgrade schema (idempotent)."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'directory_centers' in inspector.get_table_names():
        op.drop_table('directory_centers')
