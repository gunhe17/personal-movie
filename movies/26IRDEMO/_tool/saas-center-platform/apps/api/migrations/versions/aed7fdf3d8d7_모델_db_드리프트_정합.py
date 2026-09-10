"""모델-DB 드리프트 정합 — agent 레거시 테이블 컬럼명

Revision ID: aed7fdf3d8d7
Revises: c09070d7e713
Create Date: 2026-08-14 12:12:14.768602

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aed7fdf3d8d7'
down_revision: Union[str, Sequence[str], None] = 'c09070d7e713'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(
    table: str,
    column: str,
) -> bool:
    return op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def upgrade() -> None:
    # autogenerate는 이 셋을 drop+add로 냈다 — 같은 값을 담는 컬럼이라 rename이어야 데이터가 산다.
    # 스키마 출처가 모델(create_all)·alembic 두 트랙이라 이미 새 이름인 DB가 존재한다(가드 이유).
    if _column_exists('agent_messages', 'type'):
        op.alter_column('agent_messages', 'type', new_column_name='message_type')

    if _column_exists('agent_runs', 'type'):
        op.alter_column('agent_runs', 'type', new_column_name='run_type')

    if not _column_exists('agent_runs', 'agent_name'):
        op.add_column('agent_runs', sa.Column('agent_name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    if _column_exists('agent_runs', 'agent_name'):
        op.drop_column('agent_runs', 'agent_name')

    if _column_exists('agent_runs', 'run_type'):
        op.alter_column('agent_runs', 'run_type', new_column_name='type')

    if _column_exists('agent_messages', 'message_type'):
        op.alter_column('agent_messages', 'message_type', new_column_name='type')
