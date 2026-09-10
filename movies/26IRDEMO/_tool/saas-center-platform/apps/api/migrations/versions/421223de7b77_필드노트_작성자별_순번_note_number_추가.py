"""필드노트 작성자별 순번 note_number 추가

Revision ID: 421223de7b77
Revises: b55c9595f707
Create Date: 2026-06-18 09:59:15.790234

작성자(author_id)별로 생성순 1부터 매기는 note_number 컬럼을 추가한다.
미연결 필드노트 카드 라벨("필드노트 N")용. 삭제분 포함 max+1 로 부여하므로
번호는 단조 증가하며 재사용되지 않는다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '421223de7b77'
down_revision: Union[str, Sequence[str], None] = 'b55c9595f707'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'field_notes',
        sa.Column(
            'note_number',
            sa.Integer(),
            nullable=True,
            comment='작성자별 생성 순번 (1부터, 삭제돼도 재사용 안 함). 미연결 카드 라벨용',
        ),
    )

    # 기존 데이터 backfill — (center_id, author_id) 그룹별 생성순(created_at, id) 1..n.
    # 삭제분도 포함해 번호를 매겨, 이후 max+1 부여가 단조 증가하도록 한다.
    op.execute(
        """
        WITH numbered AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY center_id, author_id
                    ORDER BY created_at, id
                ) AS rn
            FROM field_notes
        )
        UPDATE field_notes fn
        SET note_number = numbered.rn
        FROM numbered
        WHERE fn.id = numbered.id
        """
    )

    # 작성자별 순번 unique (살아있는 노트 기준) — 동시 생성 race backstop.
    op.create_index(
        'idx_field_note_author_number',
        'field_notes',
        ['center_id', 'author_id', 'note_number'],
        unique=True,
        postgresql_where=sa.text('note_number IS NOT NULL AND deleted_at IS NULL'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'idx_field_note_author_number',
        table_name='field_notes',
        postgresql_where=sa.text('note_number IS NOT NULL AND deleted_at IS NULL'),
    )
    op.drop_column('field_notes', 'note_number')
