"""client: profile_image_url 컬럼 추가 (내담자 프로필 이미지)

내담자/보호자(clients)에 프로필 이미지 URL을 저장한다.
- 업로드한 사진 또는 성별 매칭 기본 아바타(S3 default-avatars) URL
- nullable: 기존 행 및 성별 미지정 등 폴백 상황 허용 (프론트는 이니셜 아바타로 폴백)

Revision ID: a1c4e7d2b9f0
Revises: d9b3f6a2c811
Create Date: 2026-06-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4e7d2b9f0'
down_revision: Union[str, Sequence[str], None] = 'd9b3f6a2c811'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "clients",
        sa.Column(
            "profile_image_url",
            sa.String(length=500),
            nullable=True,
            comment="프로필 이미지 URL (업로드 사진 또는 기본 아바타)",
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("clients", "profile_image_url")
