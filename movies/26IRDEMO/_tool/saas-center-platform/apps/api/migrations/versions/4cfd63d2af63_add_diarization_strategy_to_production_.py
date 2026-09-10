"""add_diarization_strategy_to_production_ai_configs

Revision ID: 4cfd63d2af63
Revises: a9a90085395c
Create Date: 2026-05-27 13:35:37.175359

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4cfd63d2af63'
down_revision: Union[str, Sequence[str], None] = 'a9a90085395c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """production_ai_configs에 diarization_strategy 컬럼 추가 (멱등)."""
    conn = op.get_bind()
    exists = conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'production_ai_configs' AND column_name = 'diarization_strategy')"),
    ).scalar()
    if not exists:
        op.add_column(
            'production_ai_configs',
            sa.Column(
                'diarization_strategy',
                sa.String(length=20),
                nullable=True,
                comment='화자분리 전략 (integrated|specialized, stt_diarize 전용)',
            ),
        )


def downgrade() -> None:
    """diarization_strategy 컬럼 제거."""
    op.drop_column('production_ai_configs', 'diarization_strategy')
