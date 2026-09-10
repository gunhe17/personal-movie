"""구성원 색상 백필

Revision ID: c09070d7e713
Revises: a4c1d27e9b53
Create Date: 2026-08-10 13:22:11.970546

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c09070d7e713'
down_revision: Union[str, Sequence[str], None] = 'a4c1d27e9b53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# AssignMemberColorService.COLOR_PALETTE 스냅샷 (마이그레이션은 앱 코드를 import하지 않는다)
COLOR_PALETTE = [
    "#F47500", "#017750", "#0176D0", "#49AAEF", "#EF4967",
    "#A78BFA", "#1395A1", "#22C55E", "#0EA5E9", "#EAB308",
    "#F97316", "#EC4899", "#6366F1", "#14B8A6", "#84CC16",
    "#DC2626", "#7C3AED", "#059669", "#D946EF", "#CA8A04",
    "#2563EB", "#E11D48", "#0D9488", "#9333EA", "#65A30D",
    "#C026D3", "#0891B2", "#DB2777", "#4F46E5", "#16A34A",
    "#EA580C", "#7E22CE", "#0284C7", "#BE185D", "#15803D",
    "#B45309", "#4338CA", "#0F766E", "#BE123C", "#1D4ED8",
    "#A16207", "#6D28D9", "#047857", "#9F1239", "#1E40AF",
    "#4D7C0F",
]


def upgrade() -> None:
    """members.color IS NULL 행에 센터별 최소 사용 색을 배정 (AssignMemberColorService와 동일 로직)."""
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, center_id, color FROM members "
            "WHERE deleted_at IS NULL ORDER BY center_id, created_at"
        )
    ).fetchall()

    by_center: dict[str, list] = {}
    for row in rows:
        by_center.setdefault(row.center_id, []).append(row)

    for members in by_center.values():
        usage = {c: 0 for c in COLOR_PALETTE}
        for m in members:
            if m.color in usage:
                usage[m.color] += 1
        for m in members:
            if m.color is None:
                color = min(COLOR_PALETTE, key=lambda c: usage[c])
                usage[color] += 1
                bind.execute(
                    sa.text("UPDATE members SET color = :color WHERE id = :id"),
                    {"color": color, "id": m.id},
                )


def downgrade() -> None:
    """백필된 색과 기존 색을 구분할 수 없어 되돌리지 않는다."""
    pass
