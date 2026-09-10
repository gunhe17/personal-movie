"""remove member email, fix event_ref index, add notification_settings and notification_logs

- members 테이블에서 email 컬럼 삭제 (불필요)
- notifications.event_ref 인덱스를 (event_ref, recipient_id) 복합 유니크로 변경
- notification_settings 테이블 생성 (사용자별 채널 설정)
- notification_logs 테이블 생성 (외부 채널 발송 로그)

Revision ID: e6a3b8c9d2f4
Revises: d5f2a3b7c8e1
Create Date: 2026-03-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e6a3b8c9d2f4'
down_revision: Union[str, Sequence[str], None] = 'd5f2a3b7c8e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
    ), {"t": name}).scalar()


def _index_exists(name: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": name}).scalar()


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    return conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c)"
    ), {"t": table, "c": column}).scalar()


def upgrade() -> None:
    """Upgrade schema."""

    # 1. members 테이블에서 email 컬럼 삭제
    if _column_exists('members', 'email'):
        op.drop_column('members', 'email')

    # 2. notifications.event_ref 인덱스 변경
    #    기존: event_ref만으로 unique → 다수 수신자에게 동일 이벤트 알림 불가
    #    변경: (event_ref, recipient_id) 복합 unique → 수신자별 중복 방지
    if _index_exists('ix_notifications_event_ref'):
        op.drop_index('ix_notifications_event_ref', table_name='notifications')
    op.create_index(
        'ix_notifications_event_ref',
        'notifications',
        ['event_ref', 'recipient_id'],
        unique=True,
        if_not_exists=True,
    )

    # 3. notification_settings 테이블 생성
    if not _table_exists('notification_settings'):
        op.create_table(
            'notification_settings',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
            sa.Column('account_id', sa.String(length=36), nullable=False, comment='사용자 account_id'),
            sa.Column('category', sa.String(length=30), nullable=False, comment='알림 대분류 (* = 전체)'),
            sa.Column('channel_in_app', sa.Boolean(), nullable=False, server_default=sa.text('true'), comment='인앱 알림 활성화'),
            sa.Column('channel_push', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='웹 푸시 활성화'),
            sa.Column('channel_alarmtalk', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='카카오 알림톡 활성화'),
            sa.PrimaryKeyConstraint('id'),
        )
    if not _index_exists('ix_notification_settings_account'):
        op.create_index(
            'ix_notification_settings_account',
            'notification_settings',
            ['center_id', 'account_id', 'category'],
            unique=True,
        )

    # 4. notification_logs 테이블 생성
    if not _table_exists('notification_logs'):
        op.create_table(
            'notification_logs',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.Column('notification_id', sa.String(length=36), nullable=True, comment='원본 Notification ID'),
            sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
            sa.Column('recipient_id', sa.String(length=36), nullable=False, comment='수신자 ID'),
            sa.Column('channel', sa.String(length=20), nullable=False, comment='발송 채널 (alarmtalk, push, sms)'),
            sa.Column('status', sa.String(length=20), nullable=False, comment='발송 상태 (pending, sent, failed)'),
            sa.Column('error_message', sa.Text(), nullable=True, comment='실패 시 에러 메시지'),
            sa.Column('sent_at', sa.DateTime(), nullable=True, comment='발송 완료 시각 (UTC)'),
            sa.Column('request_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='발송 요청 데이터 (디버깅용)'),
            sa.PrimaryKeyConstraint('id'),
        )
    if not _index_exists('ix_notification_logs_notification'):
        op.create_index(
            'ix_notification_logs_notification',
            'notification_logs',
            ['notification_id'],
        )
    if not _index_exists('ix_notification_logs_recipient'):
        op.create_index(
            'ix_notification_logs_recipient',
            'notification_logs',
            ['center_id', 'recipient_id', 'created_at'],
        )
    if not _index_exists('ix_notification_logs_status'):
        op.create_index(
            'ix_notification_logs_status',
            'notification_logs',
            ['status', 'created_at'],
        )


def downgrade() -> None:
    """Downgrade schema."""
    # notification_logs 삭제
    op.drop_index('ix_notification_logs_status', table_name='notification_logs')
    op.drop_index('ix_notification_logs_recipient', table_name='notification_logs')
    op.drop_index('ix_notification_logs_notification', table_name='notification_logs')
    op.drop_table('notification_logs')

    # notification_settings 삭제
    op.drop_index('ix_notification_settings_account', table_name='notification_settings')
    op.drop_table('notification_settings')

    # event_ref 인덱스 복원 (원래 event_ref만 unique)
    op.drop_index('ix_notifications_event_ref', table_name='notifications')
    op.create_index(
        'ix_notifications_event_ref',
        'notifications',
        ['event_ref'],
        unique=True,
    )

    # members.email 컬럼 복원
    op.add_column(
        'members',
        sa.Column('email', sa.String(length=255), nullable=True),
    )
