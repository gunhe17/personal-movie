"""로르샤하 채점 낡음 표시 컬럼 추가

Revision ID: e622f2c04cb1
Revises: s0rtseq01
Create Date: 2026-08-25 15:01:07.327321

`rorschach_responses.coding_stale_at` 하나만 추가한다.

⚠️ **autogenerate가 만든 나머지는 전부 지웠다.** 인덱스 이름 정리
(`ix_rorschach_responses_card` → `..._card_no` 등), `server_default` 제거,
컬럼 주석 동기화, 그리고 `rorschach_responses.region_id` **삭제**까지 딸려
나왔는데 이 작업과 무관하다. 특히 `region_id`는 모델에서만 빠지고 DB에는
남겨 둔 되돌리기용 잔존 컬럼이라(§4-1 관계 역전) 여기서 지우면 안 된다.

무관한 스키마 정리는 그것만 다루는 마이그레이션으로 따로 낸다 — 한 리비전에
섞으면 되돌릴 때 이 컬럼 하나 때문에 나머지까지 함께 되돌아간다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e622f2c04cb1'
down_revision: Union[str, None] = 's0rtseq01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'rorschach_responses',
        sa.Column('coding_stale_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('rorschach_responses', 'coding_stale_at')
