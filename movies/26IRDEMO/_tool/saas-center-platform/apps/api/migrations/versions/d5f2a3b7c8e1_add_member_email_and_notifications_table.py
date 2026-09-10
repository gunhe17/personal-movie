"""add member email and notifications table

- members 테이블에 email 컬럼 추가 (센터 업무용 이메일)
- notifications 테이블 생성 (인앱 알림)
- 기존 멤버 email 백필 (Person → Account → email)

Revision ID: d5f2a3b7c8e1
Revises: c3a7f1b2d4e6
Create Date: 2026-03-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd5f2a3b7c8e1'
down_revision: Union[str, Sequence[str], None] = 'c3a7f1b2d4e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema + data."""

    # 1. members 테이블에 email 컬럼 추가
    op.add_column(
        'members',
        sa.Column('email', sa.String(length=255), nullable=True),
    )

    # 2. 기존 멤버 email 백필 (Member → Person → Account → email)
    conn = op.get_bind()
    conn.execute(text("""
        UPDATE members m
        SET email = a.email
        FROM persons p
        JOIN accounts a ON a.id = p.account_id
        WHERE m.person_id = p.id
          AND m.email IS NULL
          AND m.deleted_at IS NULL
    """))

    # 3. notifications 테이블 생성 (이미 존재하면 스킵)
    table_exists = conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')"
    )).scalar()

    if not table_exists:
        op.create_table(
            'notifications',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
            sa.Column('recipient_id', sa.String(length=36), nullable=False, comment='수신자 account_id'),
            sa.Column('category', sa.String(length=30), nullable=False, comment='대분류 (assessment, counseling, system)'),
            sa.Column('event_type', sa.String(length=50), nullable=False, comment='이벤트 종류'),
            sa.Column('priority', sa.String(length=20), nullable=False, comment='중요도 (important, normal)'),
            sa.Column('title', sa.String(length=200), nullable=False, comment='알림 제목'),
            sa.Column('body', sa.Text(), nullable=False, comment='알림 본문'),
            sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='추가 데이터 (링크, 엔티티 ID 등)'),
            sa.Column('is_read', sa.Boolean(), nullable=False, default=False, comment='읽음 여부'),
            sa.Column('read_at', sa.DateTime(), nullable=True, comment='읽은 시각 (UTC)'),
            sa.Column('event_ref', sa.String(length=200), nullable=True, comment='이벤트 참조 키 (중복 방지용)'),
            sa.PrimaryKeyConstraint('id'),
        )

        # 4. notifications 인덱스 생성
        op.create_index(
            'ix_notifications_recipient',
            'notifications',
            ['center_id', 'recipient_id', 'is_read', 'created_at'],
        )
        op.create_index(
            'ix_notifications_event_ref',
            'notifications',
            ['event_ref'],
            unique=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_notifications_event_ref', table_name='notifications')
    op.drop_index('ix_notifications_recipient', table_name='notifications')
    op.drop_table('notifications')
    op.drop_column('members', 'email')
