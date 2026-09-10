"""fix assessment_sets.assessment_summary legacy 'type' key -> 'assessment_type'

Revision ID: b7e2f4a1c8d3
Revises: a4c1d27e9b53
Create Date: 2026-08-05

배경
----
`AssessmentSummary` 스키마는 `assessment_type` 을 필수로 요구하는데, 과거 코드가
`assessment_sets.assessment_summary` 스냅샷에 `type` 키로 저장해 두었다.
현재 생산자(`AssessmentSetFacade._build_assessment_summary`)는 이미 `assessment_type`
으로 쓰고 있으므로, 남은 레거시 행만 같은 형태로 정렬한다.

이 드리프트로 `AssessmentSetResponse.model_validate()` 가 ValidationError 를 던져
아래 경로가 모두 500 이었다:
  - 검사 케이스 상세 (get_case_handler)
  - 청구 prefill (build_billable_prefill_for_case)
  - 청구 대상 목록 (list_billable_targets_by_client)
  - 검사 세트 단건 조회 (get_set_handler)

주의
----
- 키 이름만 바꾸고 값은 보존한다.
- `WITH ORDINALITY` 로 배열 순서를 유지한다(세트 내 검사 순서는 의미가 있다).
- 이미 `assessment_type` 인 항목은 건드리지 않아 멱등하다.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7e2f4a1c8d3'
down_revision: Union[str, Sequence[str], None] = 'a4c1d27e9b53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 원소 하나를 {old_key: ...} -> {new_key: ...} 로 바꾸는 공통 본문.
# 대상 행이 없으면 UPDATE 자체가 no-op 이다.
_RENAME_SQL = """
UPDATE assessment_sets
SET assessment_summary = (
    SELECT jsonb_agg(
        CASE
            WHEN e ? '{old}' AND NOT (e ? '{new}')
            THEN (e - '{old}') || jsonb_build_object('{new}', e -> '{old}')
            ELSE e
        END
        ORDER BY ord
    )
    FROM jsonb_array_elements(assessment_summary) WITH ORDINALITY AS x(e, ord)
)
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(assessment_summary) e
    WHERE e ? '{old}' AND NOT (e ? '{new}')
);
"""


def upgrade() -> None:
    """type -> assessment_type"""
    op.execute(_RENAME_SQL.format(old='type', new='assessment_type'))


def downgrade() -> None:
    """assessment_type -> type (롤백 시 옛 형태로 복원)"""
    op.execute(_RENAME_SQL.format(old='assessment_type', new='type'))
