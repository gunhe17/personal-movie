"""add reference_segments to lab_sample_datasets

화자분리 정확도 측정용 정답(ground-truth) 화자 라벨 저장 컬럼.
샘플당 1회 정답을 만들어두면 음향/텍스트 화자분리 결과를 정답 대비 정확도로 비교 가능.

Revision ID: a3f5c1d92b47
Revises: f1a9c7d3b5e2
Create Date: 2026-06-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a3f5c1d92b47'
down_revision: Union[str, Sequence[str], None] = 'f1a9c7d3b5e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    cols = [c["name"] for c in inspect(op.get_bind()).get_columns(table)]
    return column in cols


def upgrade() -> None:
    """Upgrade schema (idempotent — 컬럼이 이미 있으면 건너뜀)."""
    if _has_column('lab_sample_datasets', 'reference_segments'):
        return
    op.add_column(
        'lab_sample_datasets',
        sa.Column(
            'reference_segments',
            sa.Text(),
            nullable=True,
            comment='정답 화자분리 세그먼트(JSON) — 정확도 비교 기준',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    if _has_column('lab_sample_datasets', 'reference_segments'):
        op.drop_column('lab_sample_datasets', 'reference_segments')
