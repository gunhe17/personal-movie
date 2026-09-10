"""아무도 안 읽는 컬럼 3개 제거 — 쓰는 코드도 없어 전 행이 비어 있다

Revision ID: dead0col1
Revises: rgn0drop1

세 칸 다 **모델 정의와 docstring에만 존재**했다(2026-08-26 전수 확인).
읽는 코드 0건, 쓰는 코드 0건. 실데이터도 전 행 NULL/false였다
(조각 237행 중 0, 반응 243행 중 0).

    rorschach_regions.area_match_score
        "저장 시점의 표준 영역 최고 IoU. 낮으면 화면이 경고한다"고 적혀 있었다.
        화면은 경고하지 않는다. **하겠다고 적힌 적만 있는 기능**이다.

    rorschach_regions.drawn_orientation
        "그릴 당시 화면의 카드 방향 — 좌표 변환 파라미터의 출처."
        그런데 `path_json`이 **이미 정위(∧) 기준으로 역회전해서 저장된다**(§5-1).
        변환이 저장 시점에 끝나므로 파라미터를 남길 이유가 없었다.

    rorschach_responses.stt_edited
        "임상가가 STT 초안을 고쳤는가 (AI 초안 수용률 — V&V 지표)."
        이 값은 **파생된다**: `free_association_stt_raw != free_association_text`.
        두 칸이 이미 있으므로(§4-2) 저장하면 `Region.label`·`color`와 같은
        자리가 된다 — 원본이 바뀌어도 저장된 불리언만 옛 판단에 머문다.
        V&V 지표가 필요하면 그때 두 칸에서 세면 되고, 그쪽이 늘 맞다.

왜 "채워는 두되 안 읽는다"로 두지 않는가
----------------------------------------
`rgn0drop1`과 같은 이유다. 빈 칸이 남아 있으면 다음 사람이 "여기 값이
들어오는구나" 하고 읽는 코드를 붙인다. 그러면 **항상 NULL인 값에 분기가
생긴다** — area_match_score의 "낮으면 경고"가 정확히 그 모양이었다.

되돌리기
--------
downgrade는 컬럼을 되살린다. 값은 복원할 것이 없다(원래 전부 비어 있었다).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'dead0col1'
down_revision: Union[str, None] = 'rgn0drop1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('rorschach_regions', 'area_match_score')
    op.drop_column('rorschach_regions', 'drawn_orientation')
    op.drop_column('rorschach_responses', 'stt_edited')


def downgrade() -> None:
    op.add_column(
        'rorschach_regions',
        sa.Column('area_match_score', sa.Float(), nullable=True),
    )
    op.add_column(
        'rorschach_regions',
        sa.Column('drawn_orientation', sa.String(length=10), nullable=True),
    )
    op.add_column(
        'rorschach_responses',
        sa.Column('stt_edited', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
