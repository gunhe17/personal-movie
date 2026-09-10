"""add tokens_per_credit and credits_charged to llm_calls

Revision ID: 925b7a4fbef3
Revises: c3e7b1d9f4a2
Create Date: 2026-05-20 20:08:25.049997

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '925b7a4fbef3'
down_revision: Union[str, Sequence[str], None] = 'c3e7b1d9f4a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """llm_calls 테이블에 크레딧 환산 스냅샷 컬럼 추가."""
    op.add_column('llm_calls', sa.Column('tokens_per_credit', sa.Integer(), nullable=True, comment='호출 시점 1크레딧당 토큰 수'))
    op.add_column('llm_calls', sa.Column('credits_charged', sa.Integer(), nullable=True, comment='실제 차감된 크레딧 수 (무료 purpose는 0)'))


def downgrade() -> None:
    """llm_calls 테이블에서 크레딧 환산 스냅샷 컬럼 제거."""
    op.drop_column('llm_calls', 'credits_charged')
    op.drop_column('llm_calls', 'tokens_per_credit')
