"""Add programs module: drop counselings, rename counseling_cases.counseling_id

Revision ID: a7f3e2b1c4d5
Revises: 9c2b1c8d4f1a
Create Date: 2026-02-09

Note:
    programs, program_members 테이블은 이전 autogenerate로 이미 생성됨.
    이 마이그레이션은 남은 작업만 수행:
    1. counselings 테이블 삭제 (programs로 대체됨)
    2. counseling_cases.counseling_id → program_id 컬럼명 변경
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7f3e2b1c4d5"
down_revision: Union[str, Sequence[str], None] = "9c2b1c8d4f1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. 기존 counselings 테이블 삭제 (programs로 대체됨)
    op.drop_table("counselings")

    # 2. counseling_cases.counseling_id -> program_id 컬럼명 변경
    op.alter_column(
        "counseling_cases",
        "counseling_id",
        new_column_name="program_id",
    )

    # 3. 기존 인덱스 변경 (counseling_id -> program_id)
    op.drop_index("idx_counseling_case_counseling", table_name="counseling_cases")
    op.create_index(
        "idx_counseling_case_program", "counseling_cases", ["program_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    # 3. 인덱스 복원
    op.drop_index("idx_counseling_case_program", table_name="counseling_cases")
    op.create_index(
        "idx_counseling_case_counseling", "counseling_cases", ["counseling_id"]
    )

    # 2. program_id -> counseling_id 복원
    op.alter_column(
        "counseling_cases",
        "program_id",
        new_column_name="counseling_id",
    )

    # 1. counselings 테이블 복원
    op.create_table(
        "counselings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("center_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("price", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
    )
