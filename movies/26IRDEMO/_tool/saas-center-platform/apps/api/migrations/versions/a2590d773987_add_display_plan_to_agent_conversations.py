"""add display_plan to agent_conversations

Revision ID: a2590d773987
Revises: b61b734bfbb5
Create Date: 2026-04-21 16:46:52.435457

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a2590d773987'
down_revision: Union[str, Sequence[str], None] = 'b61b734bfbb5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    """테이블에 컬럼이 이미 존재하는지 확인."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.scalar() is not None


def _index_exists(index_name: str) -> bool:
    """인덱스가 이미 존재하는지 확인."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes WHERE indexname = :name"
        ),
        {"name": index_name},
    )
    return result.scalar() is not None


def _add_column_safe(table: str, column: sa.Column) -> None:
    """컬럼이 없을 때만 추가."""
    if not _column_exists(table, column.name):
        op.add_column(table, column)


def _drop_column_safe(table: str, column: str) -> None:
    """컬럼이 있을 때만 삭제."""
    if _column_exists(table, column):
        op.drop_column(table, column)


def _drop_index_safe(index_name: str, table_name: str) -> None:
    """인덱스가 있을 때만 삭제."""
    if _index_exists(index_name):
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    """agent v3 스키마 업데이트."""
    # agent_conversations: display_plan, vars 추가 / runtime_state, plan, turns 제거
    _add_column_safe('agent_conversations', sa.Column('display_plan', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    _add_column_safe('agent_conversations', sa.Column('vars', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    _drop_column_safe('agent_conversations', 'runtime_state')
    _drop_column_safe('agent_conversations', 'plan')
    _drop_column_safe('agent_conversations', 'turns')

    # agent_messages: conversation_id, display_message, type 추가 / run_id 등 제거
    _add_column_safe('agent_messages', sa.Column('conversation_id', sa.String(length=36), nullable=True))
    _add_column_safe('agent_messages', sa.Column('display_message', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    _add_column_safe('agent_messages', sa.Column('type', sa.String(length=20), nullable=True))
    if _column_exists('agent_messages', 'role'):
        op.alter_column('agent_messages', 'role',
                   existing_type=sa.VARCHAR(length=10),
                   type_=sa.String(length=20),
                   existing_nullable=False)
    _drop_index_safe('ix_messages_run_seq', 'agent_messages')
    if not _index_exists('ix_agent_messages_conversation_id'):
        op.create_index(op.f('ix_agent_messages_conversation_id'), 'agent_messages', ['conversation_id'], unique=False)
    if not _index_exists('ix_messages_conversation_seq'):
        op.create_index('ix_messages_conversation_seq', 'agent_messages', ['conversation_id', 'sequence'], unique=False)
    _drop_column_safe('agent_messages', 'tool_calls')
    _drop_column_safe('agent_messages', 'run_id')
    _drop_column_safe('agent_messages', 'tool_result')
    _drop_column_safe('agent_messages', 'llm_call_ids')

    # agent_runs: type, input_data, output_data, llm_call_id, latency_ms 추가 / input, output 등 제거
    _add_column_safe('agent_runs', sa.Column('type', sa.String(length=20), nullable=True))
    _add_column_safe('agent_runs', sa.Column('input_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    _add_column_safe('agent_runs', sa.Column('output_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    _add_column_safe('agent_runs', sa.Column('llm_call_id', sa.String(length=36), nullable=True))
    _add_column_safe('agent_runs', sa.Column('latency_ms', sa.Float(), nullable=True))
    _drop_index_safe('ix_runs_conversation_turn', 'agent_runs')
    _drop_column_safe('agent_runs', 'input')
    _drop_column_safe('agent_runs', 'agent_type')
    _drop_column_safe('agent_runs', 'output')
    _drop_column_safe('agent_runs', 'turn')


def downgrade() -> None:
    """Revert agent v3 schema changes."""
    # agent_runs
    op.add_column('agent_runs', sa.Column('turn', sa.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('agent_runs', sa.Column('output', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('agent_runs', sa.Column('agent_type', sa.VARCHAR(length=20), autoincrement=False, nullable=False))
    op.add_column('agent_runs', sa.Column('input', sa.TEXT(), autoincrement=False, nullable=True))
    op.create_index(op.f('ix_runs_conversation_turn'), 'agent_runs', ['conversation_id', 'turn'], unique=False)
    op.drop_column('agent_runs', 'latency_ms')
    op.drop_column('agent_runs', 'llm_call_id')
    op.drop_column('agent_runs', 'output_data')
    op.drop_column('agent_runs', 'input_data')
    op.drop_column('agent_runs', 'type')

    # agent_messages
    op.add_column('agent_messages', sa.Column('llm_call_ids', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.add_column('agent_messages', sa.Column('tool_result', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.add_column('agent_messages', sa.Column('run_id', sa.VARCHAR(length=36), autoincrement=False, nullable=False))
    op.add_column('agent_messages', sa.Column('tool_calls', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.drop_index('ix_messages_conversation_seq', table_name='agent_messages')
    op.drop_index(op.f('ix_agent_messages_conversation_id'), table_name='agent_messages')
    op.create_index(op.f('ix_messages_run_seq'), 'agent_messages', ['run_id', 'sequence'], unique=False)
    op.alter_column('agent_messages', 'role',
               existing_type=sa.String(length=20),
               type_=sa.VARCHAR(length=10),
               existing_nullable=False)
    op.drop_column('agent_messages', 'type')
    op.drop_column('agent_messages', 'display_message')
    op.drop_column('agent_messages', 'conversation_id')

    # agent_conversations
    op.add_column('agent_conversations', sa.Column('turns', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.add_column('agent_conversations', sa.Column('plan', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.add_column('agent_conversations', sa.Column('runtime_state', postgresql.JSONB(astext_type=sa.Text()), autoincrement=False, nullable=True))
    op.drop_column('agent_conversations', 'vars')
    op.drop_column('agent_conversations', 'display_plan')
