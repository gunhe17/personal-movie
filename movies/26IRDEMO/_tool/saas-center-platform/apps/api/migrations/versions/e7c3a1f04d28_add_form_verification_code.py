"""forms 에 원격 작성 링크 인증 컬럼 추가

보호자가 문자 링크로 서식을 작성할 때 쓰는 4자리 인증코드 + 실패 횟수.
발송으로 태어난 인스턴스만 값을 갖는다(상담사 직접 작성은 NULL).

Revision ID: e7c3a1f04d28
Revises: d5b2f9c14e73
Create Date: 2026-09-03 15:40:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision: str = 'e7c3a1f04d28'
down_revision: Union[str, Sequence[str], None] = 'd5b2f9c14e73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def upgrade() -> None:
    if not _column_exists('forms', 'verification_code'):
        op.add_column('forms', sa.Column('verification_code', sa.String(length=4), nullable=True))
    if not _column_exists('forms', 'failed_attempts'):
        op.add_column(
            'forms',
            sa.Column('failed_attempts', sa.Integer(), nullable=False, server_default='0'),
        )


def downgrade() -> None:
    if _column_exists('forms', 'failed_attempts'):
        op.drop_column('forms', 'failed_attempts')
    if _column_exists('forms', 'verification_code'):
        op.drop_column('forms', 'verification_code')
