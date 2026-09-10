"""add module column to production_ai_configs

Revision ID: a3e7c1d92f48
Revises: 09ffc1f71c25
Create Date: 2026-04-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3e7c1d92f48'
down_revision: Union[str, Sequence[str], None] = '09ffc1f71c25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy.engine.reflection import Inspector
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    existing_columns = {col['name'] for col in inspector.get_columns('production_ai_configs')}
    if 'module' not in existing_columns:
        op.add_column(
            'production_ai_configs',
            sa.Column('module', sa.String(30), nullable=False, server_default='field_note'),
        )

    existing_indexes = {idx['name'] for idx in inspector.get_indexes('production_ai_configs')}
    if 'ix_production_ai_configs_module_step_active' not in existing_indexes:
        op.create_index(
            'ix_production_ai_configs_module_step_active',
            'production_ai_configs',
            ['module', 'pipeline_step', 'is_active'],
        )


def downgrade() -> None:
    op.drop_index('ix_production_ai_configs_module_step_active', table_name='production_ai_configs')
    op.drop_column('production_ai_configs', 'module')
