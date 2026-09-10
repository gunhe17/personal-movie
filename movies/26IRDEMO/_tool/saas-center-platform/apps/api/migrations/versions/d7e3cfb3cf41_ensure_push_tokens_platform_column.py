"""ensure push_tokens.platform column

일부 환경에서 4e1083a892f0(add_platform_column_to_push_tokens)가
기록상 적용된 것으로 처리됐지만 실제 컬럼이 추가되지 않은 케이스 복구용.
sa.inspect(conn) 기반 idempotent 적용으로, 컬럼이 이미 있는 환경에서는
무해하게 스킵된다.

Revision ID: d7e3cfb3cf41
Revises: e8659f46fa0e
Create Date: 2026-04-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7e3cfb3cf41'
down_revision: Union[str, Sequence[str], None] = 'e8659f46fa0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = {col['name'] for col in inspector.get_columns('push_tokens')}

    if 'platform' not in existing:
        op.add_column(
            'push_tokens',
            sa.Column(
                'platform',
                sa.String(length=10),
                server_default='web',
                nullable=False,
                comment='플랫폼 (web, ios, android)',
            ),
        )


def downgrade() -> None:
    """Downgrade schema."""
    # 복구용 마이그레이션이므로 downgrade는 no-op.
    # 원본 컬럼 제거는 4e1083a892f0의 downgrade가 담당.
    pass
