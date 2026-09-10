"""add diarization_status to field_notes

화자분리를 유료 온디맨드 기능으로 분리하기 위한 상태 컬럼.
기본 분석은 평문 전사까지만 수행하고, 화자분리는 사용자가 명시적으로 요청할 때 실행.

기존 노트 백필: 구 파이프라인은 분석(transcribe) 시 항상 화자분리까지 수행했으므로,
transcribe_status='completed'인 노트는 이미 화자별 전사가 존재 → diarization_status='completed'.

Revision ID: 8972e7f7b6c8
Revises: c4e8b1a7f9d2
Create Date: 2026-06-09 16:03:33.427162

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8972e7f7b6c8'
down_revision: Union[str, Sequence[str], None] = 'c4e8b1a7f9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'field_notes',
        sa.Column(
            'diarization_status',
            sa.String(length=20),
            server_default='none',
            nullable=False,
            comment='화자분리 상태 (none, processing, completed, failed) — 유료 온디맨드',
        ),
    )
    # 기존 분석 완료 노트는 구 흐름상 이미 화자분리됨 → completed 로 백필
    op.execute(
        "UPDATE field_notes SET diarization_status = 'completed' "
        "WHERE transcribe_status = 'completed'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('field_notes', 'diarization_status')
