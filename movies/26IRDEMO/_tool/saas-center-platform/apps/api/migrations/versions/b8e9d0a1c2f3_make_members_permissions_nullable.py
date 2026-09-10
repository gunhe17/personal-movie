"""Make members.permissions nullable

Member 모델에서는 권한을 Role → RolePermission → Permission으로 동적 조회하므로
permissions 컬럼을 저장하지 않음. DB에 NOT NULL로 남아 있으면 INSERT 시 오류가 나므로
nullable로 변경.

Revision ID: b8e9d0a1c2f3
Revises: 4a7068a5140c
Create Date: 2026-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b8e9d0a1c2f3"
down_revision: Union[str, Sequence[str], None] = "4a7068a5140c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "members",
        "permissions",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "members",
        "permissions",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
        server_default=sa.text("'[]'::jsonb"),
    )
