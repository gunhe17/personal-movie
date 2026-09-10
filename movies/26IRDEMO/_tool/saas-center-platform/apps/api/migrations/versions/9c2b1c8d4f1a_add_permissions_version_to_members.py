"""Add permissions_version to members

Revision ID: 9c2b1c8d4f1a
Revises: 161b14e99ee7
Create Date: 2026-02-05

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c2b1c8d4f1a"
down_revision: Union[str, Sequence[str], None] = "161b14e99ee7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "members",
        sa.Column(
            "permissions_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="권한 버전 (권한/역할 변경 감지용)",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("members", "permissions_version")

