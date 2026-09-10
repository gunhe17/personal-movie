"""add is_certified to persons

전문가 인증 여부를 Person 테이블에 캐시.
정책: 자격증 ≥1 verified AND 학력 ≥1 verified (C안)
갱신: service 레이어의 recompute_person_certification(person_id) helper 호출

Revision ID: c8d2a1f4b6e3
Revises: b7e9f3a2c8d1
Create Date: 2026-05-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'c8d2a1f4b6e3'
down_revision: Union[str, Sequence[str], None] = 'b7e9f3a2c8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS ("
        " SELECT 1 FROM information_schema.columns"
        " WHERE table_name = :t AND column_name = :c"
        ")"
    ), {"t": table, "c": name}).scalar()


def upgrade() -> None:
    if not _column_exists('persons', 'is_certified'):
        op.add_column(
            'persons',
            sa.Column(
                'is_certified',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('false'),
                comment='인증된 전문가 여부 (자격 검증 결과 캐시)',
            ),
        )

    # 기존 person들의 is_certified 백필 (C안 정책으로 일괄 계산)
    op.execute(text("""
        UPDATE persons p
        SET is_certified = TRUE
        WHERE EXISTS (
            SELECT 1 FROM person_credentials c
            WHERE c.person_id = p.id
              AND c.kind = 'certification'
              AND c.verification_status = 'verified'
              AND c.deleted_at IS NULL
        )
        AND EXISTS (
            SELECT 1 FROM person_credentials c
            WHERE c.person_id = p.id
              AND c.kind = 'education'
              AND c.verification_status = 'verified'
              AND c.deleted_at IS NULL
        )
    """))


def downgrade() -> None:
    if _column_exists('persons', 'is_certified'):
        op.drop_column('persons', 'is_certified')
