"""add opinion to assessment_tasks

Revision ID: b4c1e9f0a2d7
Revises: a3f2e7b8c910
Create Date: 2026-04-16 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4c1e9f0a2d7'
down_revision: Union[str, Sequence[str], None] = 'a3f2e7b8c910'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """AssessmentTask에 검사자 소견(opinion) 컬럼 추가"""
    op.add_column(
        'assessment_tasks',
        sa.Column(
            'opinion',
            sa.Text(),
            nullable=True,
            comment='검사별 검사자 소견 (마지막 스텝에서 작성)',
        ),
    )


def downgrade() -> None:
    op.drop_column('assessment_tasks', 'opinion')
