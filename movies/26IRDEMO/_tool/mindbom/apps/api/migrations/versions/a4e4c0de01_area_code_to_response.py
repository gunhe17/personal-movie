"""area_code를 조각에서 반응으로 (§14-7)

위치 부호는 반응당 1개다. 조각에 두면 조각과 반응이 1:1인데 값을 담는 자리가
둘이 되어, 서로 다른 값을 넣어도 아무도 막지 않았다. 채점은 "조각 중 첫 값"을
조용히 골랐고 나머지는 화면에만 남았다.

이관 규칙: 반응당 조각이 최대 1개이므로 그 조각의 area_code를 그대로 옮긴다.
(이관 전 실측 — 반응당 조각 0개 7건 / 1개 107건 / 2개 이상 0건)

Revision ID: a4e4c0de01
Revises: r3v3rs31
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4e4c0de01"
down_revision: Union[str, None] = "r3v3rs31"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rorschach_responses",
        sa.Column("area_code", sa.String(length=20), nullable=True),
    )

    # 조각의 부호를 소유 반응으로 옮긴다. 조각이 2개 이상인 반응은 없지만,
    # 있더라도 살아있는 조각 중 부호가 있는 것 하나를 쓴다 — 옛 채점 코드가
    # 하던 것과 같은 선택이라 이관으로 값이 바뀌지 않는다.
    op.execute(
        """
        UPDATE rorschach_responses r
        SET area_code = g.area_code
        FROM (
            SELECT DISTINCT ON (response_id) response_id, area_code
            FROM rorschach_regions
            WHERE deleted_at IS NULL AND area_code IS NOT NULL
            ORDER BY response_id, created_at
        ) g
        WHERE g.response_id = r.id
        """
    )

    op.drop_column("rorschach_regions", "area_code")


def downgrade() -> None:
    op.add_column(
        "rorschach_regions",
        sa.Column("area_code", sa.String(length=20), nullable=True),
    )
    # 반응의 부호를 그 반응의 조각들에 되돌린다.
    op.execute(
        """
        UPDATE rorschach_regions g
        SET area_code = r.area_code
        FROM rorschach_responses r
        WHERE g.response_id = r.id AND r.area_code IS NOT NULL
        """
    )
    op.drop_column("rorschach_responses", "area_code")
