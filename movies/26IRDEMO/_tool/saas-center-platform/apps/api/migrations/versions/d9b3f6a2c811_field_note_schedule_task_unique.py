"""field_note: schedule_id/task_id partial unique (회기·검사 1:1)

필드노트를 한 회기(schedule)·한 검사(task)에 1개만 연결되도록 강제한다.
- 기존 비-unique 인덱스(idx_field_note_schedule, idx_field_note_task) 제거
- 살아있는(미삭제) 노트 기준 partial unique 인덱스로 재생성
  (deleted_at IS NULL 조건 → soft delete 후 같은 회기/검사에 재연결 가능)

⚠️ 데이터 정리: unique 생성 전, 같은 schedule_id/task_id에 살아있는 노트가
   2개 이상이면 가장 최근(created_at DESC) 1개만 남기고 나머지는 soft delete 한다.
   (회기는 앱 레벨에서 이미 1:1 강제됐으나, 검사는 1:N 허용이었어 중복 가능성 있음.)

Revision ID: d9b3f6a2c811
Revises: e2d7c4b9f1a8
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9b3f6a2c811'
down_revision: Union[str, Sequence[str], None] = 'e2d7c4b9f1a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. 기존 비-unique 인덱스 제거
    op.drop_index("idx_field_note_schedule", table_name="field_notes")
    op.drop_index("idx_field_note_task", table_name="field_notes")

    # 2. 중복 정리 — 같은 회기/검사에 살아있는 노트가 2개 이상이면 최신 1개만 유지,
    #    나머지는 soft delete (hard delete 아님 → 복구 가능).
    op.execute(
        sa.text(
            """
            UPDATE field_notes f
            SET deleted_at = now()
            WHERE f.deleted_at IS NULL
              AND f.schedule_id IS NOT NULL
              AND f.id NOT IN (
                SELECT DISTINCT ON (schedule_id) id
                FROM field_notes
                WHERE deleted_at IS NULL AND schedule_id IS NOT NULL
                ORDER BY schedule_id, created_at DESC
              )
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE field_notes f
            SET deleted_at = now()
            WHERE f.deleted_at IS NULL
              AND f.task_id IS NOT NULL
              AND f.id NOT IN (
                SELECT DISTINCT ON (task_id) id
                FROM field_notes
                WHERE deleted_at IS NULL AND task_id IS NOT NULL
                ORDER BY task_id, created_at DESC
              )
            """
        )
    )

    # 3. partial unique 인덱스 생성 (살아있는 노트 기준)
    op.create_index(
        "idx_field_note_schedule",
        "field_notes",
        ["schedule_id"],
        unique=True,
        postgresql_where=sa.text("schedule_id IS NOT NULL AND deleted_at IS NULL"),
    )
    op.create_index(
        "idx_field_note_task",
        "field_notes",
        ["task_id"],
        unique=True,
        postgresql_where=sa.text("task_id IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    # partial unique → 기존 비-unique 인덱스로 복구. (soft delete 된 중복은 되돌리지 않음.)
    op.drop_index("idx_field_note_schedule", table_name="field_notes")
    op.drop_index("idx_field_note_task", table_name="field_notes")
    op.create_index("idx_field_note_schedule", "field_notes", ["schedule_id"])
    op.create_index("idx_field_note_task", "field_notes", ["task_id"])
