"""add code to clients

Revision ID: 80f9674f0add
Revises: b8e9d0a1c2f3
Create Date: 2026-02-12 15:27:16.930385

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '80f9674f0add'
down_revision: Union[str, Sequence[str], None] = 'b8e9d0a1c2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6


def _generate_code() -> str:
    import secrets
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def upgrade() -> None:
    """Upgrade schema."""
    # 1. nullable=True로 컬럼 추가
    op.add_column('clients', sa.Column(
        'code', sa.String(length=6), nullable=True,
        comment='클라이언트 식별 코드 (센터별 6자리 랜덤)',
    ))

    # 2. 기존 행에 센터별 유니크한 랜덤 코드 부여
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, center_id FROM clients")).fetchall()

    used_codes: dict[str, set[str]] = {}  # center_id -> set of codes
    for row_id, center_id in rows:
        if center_id not in used_codes:
            existing = conn.execute(
                sa.text("SELECT code FROM clients WHERE center_id = :cid AND code IS NOT NULL"),
                {"cid": center_id},
            ).fetchall()
            used_codes[center_id] = {r[0] for r in existing}

        code = _generate_code()
        while code in used_codes[center_id]:
            code = _generate_code()
        used_codes[center_id].add(code)

        conn.execute(
            sa.text("UPDATE clients SET code = :code WHERE id = :id"),
            {"code": code, "id": row_id},
        )

    # 3. NOT NULL로 변경 + 유니크 제약
    op.alter_column('clients', 'code', nullable=False)
    op.create_unique_constraint('uq_clients_center_code', 'clients', ['center_id', 'code'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_clients_center_code', 'clients', type_='unique')
    op.drop_column('clients', 'code')
