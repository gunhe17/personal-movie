"""add voucher_form_templates table

바우처 ↔ 서식 템플릿 N:M 링크. 서식 문서는 하나, 참조하는 바우처는 여럿.
귀속은 추론하지 않고 영역 확정 화면의 소속 선택이 정본이다.

Revision ID: c4a1e8b2f931
Revises: b3f7c2a9d514
Create Date: 2026-09-02 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = 'c4a1e8b2f931'
down_revision: Union[str, Sequence[str], None] = 'b3f7c2a9d514'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name}).scalar()


def _index_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": name}).scalar()


def upgrade() -> None:
    if not _table_exists('voucher_form_templates'):
        op.create_table(
            'voucher_form_templates',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('voucher_id', sa.String(length=36), nullable=False),
            sa.Column('form_template_id', sa.String(length=36), nullable=False),
            sa.Column('kind', sa.String(length=20), nullable=False, server_default='기타'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
    # 삭제 안 된 링크만 유일 — 전역 unique 면 soft-delete 후 재링크가 막힌다
    if not _index_exists('uq_voucher_form_template'):
        op.create_index(
            'uq_voucher_form_template',
            'voucher_form_templates',
            ['voucher_id', 'form_template_id'],
            unique=True,
            postgresql_where=sa.text('deleted_at IS NULL'),
        )


def downgrade() -> None:
    if _table_exists('voucher_form_templates'):
        op.drop_table('voucher_form_templates')
