"""add color to members

Revision ID: 77bfa7d75a32
Revises: b6de9afef0f8
Create Date: 2026-04-01 16:52:42.734649

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '77bfa7d75a32'
down_revision: Union[str, Sequence[str], None] = 'b6de9afef0f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLOR_PALETTE = [
    '#F47500', '#017750', '#0176D0', '#49AAEF', '#EF4967',
    '#A78BFA', '#1395A1', '#22C55E', '#0EA5E9', '#EAB308',
    '#F97316', '#EC4899', '#6366F1', '#14B8A6', '#84CC16',
]


def upgrade() -> None:
    """Upgrade schema."""
    # 1. 컬럼 추가
    op.add_column('members', sa.Column('color', sa.String(length=7), nullable=True, comment='멤버 고유 색상 (hex, #RRGGBB)'))

    # 2. 기존 멤버 데이터 마이그레이션 (센터별 round-robin 색상 할당)
    conn = op.get_bind()
    centers = conn.execute(sa.text(
        "SELECT DISTINCT center_id FROM members WHERE deleted_at IS NULL"
    ))
    for (center_id,) in centers:
        members = conn.execute(sa.text(
            "SELECT id FROM members WHERE center_id = :cid AND deleted_at IS NULL ORDER BY created_at"
        ), {"cid": center_id})
        for idx, (member_id,) in enumerate(members):
            color = COLOR_PALETTE[idx % len(COLOR_PALETTE)]
            conn.execute(sa.text(
                "UPDATE members SET color = :color WHERE id = :mid"
            ), {"color": color, "mid": member_id})


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('members', 'color')
