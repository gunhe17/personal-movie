"""ai_lab notes를 memo로 리네임

Revision ID: 7babcaa0410b
Revises: 4e49873c4e21
Create Date: 2026-07-16 08:49:40.106535

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7babcaa0410b'
down_revision: Union[str, Sequence[str], None] = '4e49873c4e21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 자유 메모 아키타입 정합 (persistence-model §4: notes 금지 → memo). 데이터 보존 rename.
    op.alter_column("lab_experiment_groups", "notes", new_column_name="memo")
    op.alter_column("lab_experiment_runs", "notes", new_column_name="memo")


def downgrade() -> None:
    op.alter_column("lab_experiment_groups", "memo", new_column_name="notes")
    op.alter_column("lab_experiment_runs", "memo", new_column_name="notes")
