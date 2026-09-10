"""rename specialist to assistant in participant_type

Revision ID: 7482467cd007
Revises: 7d2c7d70ba68
Create Date: 2026-02-05 08:37:40.848084

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7482467cd007'
down_revision: Union[str, Sequence[str], None] = '7d2c7d70ba68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Rename 'specialist' to 'assistant' in participant_type columns.

    - assessment_case_participants.participant_type
    - assessment_session_participants.participant_type

    Note:
        - counselor (메인 검사자)는 Case.counselor_id로 관리
        - participant_type='assistant'는 보조 검사자만 의미
    """
    # 1. assessment_case_participants.participant_type 변경
    op.execute("""
        UPDATE assessment_case_participants
        SET participant_type = 'assistant'
        WHERE participant_type = 'specialist'
    """)

    # 2. assessment_session_participants.participant_type 변경
    op.execute("""
        UPDATE assessment_session_participants
        SET participant_type = 'assistant'
        WHERE participant_type = 'specialist'
    """)


def downgrade() -> None:
    """
    Revert 'assistant' back to 'specialist' in participant_type columns.
    """
    # 1. assessment_case_participants.participant_type 복원
    op.execute("""
        UPDATE assessment_case_participants
        SET participant_type = 'specialist'
        WHERE participant_type = 'assistant'
    """)

    # 2. assessment_session_participants.participant_type 복원
    op.execute("""
        UPDATE assessment_session_participants
        SET participant_type = 'specialist'
        WHERE participant_type = 'assistant'
    """)
