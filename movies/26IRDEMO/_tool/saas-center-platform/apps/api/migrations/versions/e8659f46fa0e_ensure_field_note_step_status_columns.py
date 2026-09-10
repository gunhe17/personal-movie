"""ensure field_note step status columns

이전 마이그레이션(33f28dbfcfae)의 존재 여부 체크 로직이 async connection에서
올바르게 동작하지 않아 일부 환경에서 컬럼이 추가되지 않은 채 버전만 올라간 케이스
복구용. sa.inspect(conn) 기반 idempotent 적용.

Revision ID: e8659f46fa0e
Revises: 33f28dbfcfae
Create Date: 2026-04-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8659f46fa0e'
down_revision: Union[str, Sequence[str], None] = '33f28dbfcfae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = {col['name'] for col in inspector.get_columns('field_notes')}

    if 'transcribe_status' not in existing:
        op.add_column(
            'field_notes',
            sa.Column(
                'transcribe_status',
                sa.String(length=20),
                server_default='pending',
                nullable=False,
                comment='전사 상태 (pending, processing, completed, failed)',
            ),
        )
    if 'refine_status' not in existing:
        op.add_column(
            'field_notes',
            sa.Column(
                'refine_status',
                sa.String(length=20),
                server_default='none',
                nullable=False,
                comment='보정 상태 (none, processing, completed, failed)',
            ),
        )
    if 'note_status' not in existing:
        op.add_column(
            'field_notes',
            sa.Column(
                'note_status',
                sa.String(length=20),
                server_default='none',
                nullable=False,
                comment='상담일지 상태 (none, processing, completed, failed)',
            ),
        )


def downgrade() -> None:
    """Downgrade schema."""
    # 이 마이그레이션은 복구용이므로 downgrade에서 컬럼을 제거하지 않는다.
    # 원본 컬럼 제거는 33f28dbfcfae의 downgrade가 담당.
    pass
