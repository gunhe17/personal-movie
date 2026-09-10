"""add quality_score and quality_note to lab_experiment_runs

Revision ID: 9678e7dc97a2
Revises: b4ce9cb63840
Create Date: 2026-04-02 16:32:48.560987

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect


# revision identifiers, used by Alembic.
revision: str = '9678e7dc97a2'
down_revision: Union[str, Sequence[str], None] = 'b4ce9cb63840'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    """테이블에 컬럼이 이미 존재하는지 확인."""
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    columns = [c['name'] for c in inspector.get_columns(table)]
    return column in columns


def upgrade() -> None:
    """Upgrade schema."""
    if not _has_column('lab_experiment_runs', 'quality_score'):
        op.add_column(
            'lab_experiment_runs',
            sa.Column('quality_score', sa.Integer(), nullable=True, comment='품질 점수 (1~5)'),
        )
    if not _has_column('lab_experiment_runs', 'quality_note'):
        op.add_column(
            'lab_experiment_runs',
            sa.Column('quality_note', sa.Text(), nullable=True, comment='평가 메모'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('lab_experiment_runs', 'quality_note')
    op.drop_column('lab_experiment_runs', 'quality_score')
