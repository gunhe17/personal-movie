"""reset attendance/status on sessions that have not started yet

Revision ID: c3f8a5d2e91b
Revises: b7e2f4a1c8d3
Create Date: 2026-08-06

배경
----
"출석은 회기가 진행되어야 성립한다"는 규칙이 뒤늦게 정해졌다. 그 전에는 시각 가드가
없어서 아직 시작하지 않은 회기에도 출결을 찍을 수 있었고, 일부는 회기 상태까지
'완료'로 넘어갔다. 규칙에 맞춰 남아 있는 값을 일괄 원복한다.

정리 대상 (실행 시점 기준 `schedules.start > now()`)
  1. 참여자 출결 `attendance_status <> 'scheduled'` → `'scheduled'`
  2. 회기 상태 `status <> 'scheduled'` → `'scheduled'`

안전성 (2026-08-06 dev DB 실측: 참여자 6건 / 회기 6개)
  - 회기 차감(is_consumed=true) 0건
  - 출결 사유(memo) 0건
  - 연결된 상담 일지(counseling_notes) 0건
  - 연결된 청구(billable_items.related_session_id) 0건
  → 되돌려도 유실되는 데이터가 없다.

주의
----
- 조건이 `now()` 기준이라 **실행 시점에 따라 대상이 달라진다**. 이는 의도된 것으로,
  각 환경(dev/staging/prod)이 배포 시점 기준의 '미래 회기'를 각자 정리한다.
- downgrade는 원복 불가(이전 값을 보존하지 않는다) — no-op.
- 앞으로의 유입은 프론트 가드(InlineJournalEditor.isBeforeStart)가 막는다.
  서버측 가드는 아직 없어 API 직접 호출은 통과한다(후속 과제).
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c3f8a5d2e91b'
down_revision: Union[str, Sequence[str], None] = 'b7e2f4a1c8d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 아직 시작하지 않은 회기의 id 집합. 일정(schedules)이 없는 회기는 시각을 알 수 없어 제외한다.
_FUTURE_SESSIONS = """
    SELECT cs.id
    FROM counseling_sessions cs
    JOIN schedules sch ON sch.id = cs.schedule_id
    WHERE cs.deleted_at IS NULL
      AND sch.deleted_at IS NULL
      AND sch.start > now()
"""


def upgrade() -> None:
    """미래 회기의 출결·회기 상태를 '예정'으로 원복"""
    # 1) 참여자 출결
    op.execute(
        f"""
        UPDATE counseling_session_participants
        SET attendance_status = 'scheduled'
        WHERE deleted_at IS NULL
          AND attendance_status <> 'scheduled'
          AND session_id IN ({_FUTURE_SESSIONS});
        """
    )
    # 2) 회기 상태 (출결 확정 때문에 완료로 넘어간 건들)
    op.execute(
        f"""
        UPDATE counseling_sessions
        SET status = 'scheduled'
        WHERE deleted_at IS NULL
          AND status <> 'scheduled'
          AND id IN ({_FUTURE_SESSIONS});
        """
    )


def downgrade() -> None:
    """원복 불가 — 변경 전 값을 보존하지 않는다."""
    pass
