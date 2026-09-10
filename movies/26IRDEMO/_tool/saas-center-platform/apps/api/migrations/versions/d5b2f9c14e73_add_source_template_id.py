"""form_templates 에 source_template_id 추가 + 이름 unique 를 partial 로

센터가 공용 서식을 자기 양식으로 들여올 때 출처를 새긴다. 동일성의 근거가 이름이
아니라 이 id 라서, 양식을 고치거나 이름을 바꿔도 바우처와의 연결이 끊기지 않고
같은 서식을 두 번 들여오지도 않는다.

Revision ID: d5b2f9c14e73
Revises: c4a1e8b2f931
Create Date: 2026-09-03 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = 'd5b2f9c14e73'
down_revision: Union[str, Sequence[str], None] = 'c4a1e8b2f931'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def _index_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": name}).scalar()


def upgrade() -> None:
    if not _column_exists('form_templates', 'source_template_id'):
        op.add_column(
            'form_templates',
            sa.Column('source_template_id', sa.String(length=36), nullable=True),
        )

    # 삭제된 양식이 이름을 점유하지 않도록 partial 로 (soft-delete unique 규칙)
    if _index_exists('uq_form_templates_center_name_version'):
        op.drop_index('uq_form_templates_center_name_version', table_name='form_templates')
    op.create_index(
        'uq_form_templates_center_name_version',
        'form_templates',
        ['center_id', 'name', 'version'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL'),
    )


def downgrade() -> None:
    if _index_exists('uq_form_templates_center_name_version'):
        op.drop_index('uq_form_templates_center_name_version', table_name='form_templates')
    op.create_index(
        'uq_form_templates_center_name_version',
        'form_templates',
        ['center_id', 'name', 'version'],
        unique=True,
    )
    if _column_exists('form_templates', 'source_template_id'):
        op.drop_column('form_templates', 'source_template_id')
