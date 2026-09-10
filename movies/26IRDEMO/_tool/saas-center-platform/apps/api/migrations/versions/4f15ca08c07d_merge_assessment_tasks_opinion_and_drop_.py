"""merge assessment_tasks_opinion and drop_agent_intent_templates heads

Revision ID: 4f15ca08c07d
Revises: b4c1e9f0a2d7, d4e1a9b7c2f3
Create Date: 2026-04-20 11:13:05.808237

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f15ca08c07d'
down_revision: Union[str, Sequence[str], None] = ('b4c1e9f0a2d7', 'd4e1a9b7c2f3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
