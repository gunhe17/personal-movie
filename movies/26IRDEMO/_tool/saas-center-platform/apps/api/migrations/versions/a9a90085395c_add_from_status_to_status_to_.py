"""add from_status to_status to subscription_history

Revision ID: a9a90085395c
Revises: 8f7987860a70
Create Date: 2026-05-22 11:56:54.398402

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a9a90085395c'
down_revision: Union[str, Sequence[str], None] = '8f7987860a70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── 멱등 헬퍼 (staging DB 부분 적용 상태 대응) ──

def _table_exists(conn, name: str) -> bool:
    return conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t AND table_schema = 'public')"),
        {"t": name},
    ).scalar()

def _column_exists(conn, table: str, column: str) -> bool:
    return conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c)"),
        {"t": table, "c": column},
    ).scalar()

def _index_exists(conn, name: str) -> bool:
    return conn.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :n)"),
        {"n": name},
    ).scalar()

def _safe_add_column(conn, table, column):
    col_name = column.name if hasattr(column, 'name') else column.key
    if not _column_exists(conn, table, col_name):
        op.add_column(table, column)

def _safe_create_index(conn, name, table, columns, **kw):
    if not _index_exists(conn, name):
        op.create_index(name, table, columns, **kw)


def upgrade() -> None:
    """Upgrade schema — fully idempotent."""
    conn = op.get_bind()

    # NOTE: autogenerate가 잘못 캡처한 테이블 DROP 제거.
    # AI Lab 테이블(production_ai_configs, lab_* 등)은 다른 마이그레이션에서 생성되며 유지되어야 함.

    # ── 1. billable_items 컬럼 추가 ──
    _safe_add_column(conn, 'billable_items', sa.Column('client_voucher_id', sa.String(length=36), nullable=True, comment='연결된 내담자 바우처 ID (앱레벨 FK). 청구 생성 시 1회 차감, 이후 변경 불가'))
    _safe_add_column(conn, 'billable_items', sa.Column('subsidy_amount', sa.Integer(), nullable=False, server_default='0', comment='바우처 지원금 (사용자 입력, amount에서 차감되어 본인부담금 계산)'))

    # alter_column (comment/server_default 변경)은 멱등 — 재실행해도 안전
    op.alter_column('billable_items', 'related_type',
               existing_type=sa.VARCHAR(length=50),
               comment='연관 유형: counseling_session, counseling_case, assessment_session, assessment_case',
               existing_comment='연관 유형: counseling_session, assessment_session',
               existing_nullable=True)
    op.alter_column('billable_items', 'related_session_id',
               existing_type=sa.VARCHAR(length=36),
               comment='연관 세션 ID (회차별 청구 추적용 — 패키지 선결제는 세션별 1:1 매핑)',
               existing_comment='연관 세션 ID (회차별 청구 추적용)',
               existing_nullable=True)
    op.alter_column('billable_items', 'quantity',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_comment='수량',
               existing_nullable=False)
    op.alter_column('billable_items', 'unit_price',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_comment='단가',
               existing_nullable=False)
    op.alter_column('billable_items', 'amount',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_comment='금액 (= quantity × unit_price)',
               existing_nullable=False)
    _safe_create_index(conn, 'idx_billable_items_client_voucher', 'billable_items', ['client_voucher_id'], unique=False, postgresql_where='deleted_at IS NULL AND client_voucher_id IS NOT NULL')

    # ── 3. billables 컬럼 추가 ──
    _safe_add_column(conn, 'billables', sa.Column('subsidy_amount', sa.Integer(), nullable=False, server_default='0', comment='청구서 전체 지원금 합계 (= SUM(items.subsidy_amount))'))
    op.alter_column('billables', 'total_amount',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_comment='총 금액 (= SUM(items.amount) - discount_amount)',
               existing_nullable=False)
    op.alter_column('billables', 'discount_amount',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_comment='청구서 전체 할인액 (묶음 할인 등)',
               existing_nullable=False)
    op.alter_column('billables', 'paid_amount',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_comment='결제 금액 (= SUM(payments.amount))',
               existing_nullable=False)
    op.alter_column('billables', 'unpaid_amount',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_comment='미수금 (= total - paid)',
               existing_nullable=False)
    op.alter_column('billables', 'status',
               existing_type=sa.VARCHAR(length=20),
               server_default=None,
               existing_comment='상태: draft, issued, paid, overdue',
               existing_nullable=False)

    # ── 4. center_note_preferences 인덱스 변경 (non-unique → unique) ──
    op.alter_column('center_note_preferences', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               comment='생성 시각 (UTC)',
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('center_note_preferences', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               comment='수정 시각 (UTC)',
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('center_note_preferences', 'deleted_at',
               existing_type=postgresql.TIMESTAMP(),
               comment='삭제 시각 (UTC, Soft Delete)',
               existing_nullable=True)
    if _index_exists(conn, 'ix_center_note_preferences_center_id'):
        op.drop_index(op.f('ix_center_note_preferences_center_id'), table_name='center_note_preferences')
    op.create_index(op.f('ix_center_note_preferences_center_id'), 'center_note_preferences', ['center_id'], unique=True)

    # ── 5. client_vouchers.case_id 추가 ──
    _safe_add_column(conn, 'client_vouchers', sa.Column('case_id', sa.String(length=36), nullable=True, comment='상담 케이스 counseling_case.id (앱레벨 FK, nullable)'))
    _safe_create_index(conn, 'idx_client_vouchers_case', 'client_vouchers', ['case_id'], unique=False, postgresql_where='deleted_at IS NULL')
    _safe_create_index(conn, 'uq_client_vouchers_case_client_active', 'client_vouchers', ['case_id', 'client_id'], unique=True, postgresql_where='deleted_at IS NULL AND case_id IS NOT NULL')

    # ── 6. counseling_case_analyses 변경 ──
    op.alter_column('counseling_case_analyses', 'id',
               existing_type=sa.VARCHAR(length=36),
               comment='UUID Primary Key',
               existing_nullable=False)
    op.alter_column('counseling_case_analyses', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               server_default=sa.text('now()'),
               comment='생성 시각 (UTC)',
               existing_nullable=False)
    op.alter_column('counseling_case_analyses', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               server_default=sa.text('now()'),
               comment='수정 시각 (UTC)',
               existing_nullable=False)
    op.alter_column('counseling_case_analyses', 'deleted_at',
               existing_type=postgresql.TIMESTAMP(),
               comment='삭제 시각 (UTC, Soft Delete)',
               existing_nullable=True)
    _safe_create_index(conn, 'ix_counseling_case_analyses_center_id', 'counseling_case_analyses', ['center_id'], unique=False)
    _safe_create_index(conn, 'ix_counseling_case_analyses_counseling_case_id', 'counseling_case_analyses', ['counseling_case_id'], unique=False)

    # ── 7. alter_column (comment 변경 — 멱등) ──
    op.alter_column('counseling_session_participants', 'attendance_status',
               existing_type=sa.VARCHAR(length=20),
               comment='참석 상태 (scheduled, attended, absent, late, excused, no_show)',
               existing_comment='참석 상태 (scheduled, attended, absent, late, excused)',
               existing_nullable=False)
    op.alter_column('field_notes', 'processing_status',
               existing_type=sa.VARCHAR(length=20),
               comment='파이프라인 상태 (idle, processing, completed, failed, skipped)',
               existing_comment='파이프라인 상태 (idle, processing, completed, failed)',
               existing_nullable=False,
               existing_server_default=sa.text("'idle'::character varying"))
    op.alter_column('llm_calls', 'center_id',
               existing_type=sa.VARCHAR(length=36),
               comment=None,
               existing_comment='센터 ID (field_note 호출 시 직접 참조)',
               existing_nullable=True)
    op.alter_column('llm_calls', 'source_type',
               existing_type=sa.VARCHAR(length=20),
               comment=None,
               existing_comment='호출 출처 (agent | field_note)',
               existing_nullable=False,
               existing_server_default=sa.text("'agent'::character varying"))
    op.alter_column('llm_calls', 'source_id',
               existing_type=sa.VARCHAR(length=36),
               comment=None,
               existing_comment='출처 엔티티 ID (field_note_id 등)',
               existing_nullable=True)
    op.alter_column('llm_calls', 'purpose',
               existing_type=sa.VARCHAR(length=50),
               comment=None,
               existing_comment='호출 용도 (skill_selection, field_note_stt_diarize 등)',
               existing_nullable=False)
    op.alter_column('llm_calls', 'audio_duration_seconds',
               existing_type=sa.DOUBLE_PRECISION(precision=53),
               comment=None,
               existing_comment='STT 오디오 길이 (초, 분단위 과금용)',
               existing_nullable=True)

    # ── 8. members.permissions_version 삭제 ──
    if _column_exists(conn, 'members', 'permissions_version'):
        op.drop_column('members', 'permissions_version')

    # ── 9. notification/price/push/roles alter_column (멱등) ──
    op.alter_column('notification_settings', 'category',
               existing_type=sa.VARCHAR(length=30),
               comment='알림 대분류 (assessment, counseling, system)',
               existing_comment='알림 대분류 (* = 전체)',
               existing_nullable=False)
    op.alter_column('notification_settings', 'channel_in_app',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_comment='인앱 알림 활성화',
               existing_nullable=False)
    op.alter_column('notification_settings', 'channel_push',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_comment='웹 푸시 활성화',
               existing_nullable=False)
    op.alter_column('notification_settings', 'channel_alarmtalk',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_comment='카카오 알림톡 활성화',
               existing_nullable=False)
    op.alter_column('notifications', 'priority',
               existing_type=sa.VARCHAR(length=20),
               comment='중요도 (important: 인앱+외부채널, normal: 인앱만)',
               existing_comment='중요도 (important, normal)',
               existing_nullable=False)
    op.alter_column('price_lists', 'unit_price',
               existing_type=sa.INTEGER(),
               server_default=None,
               existing_comment='단가 (원)',
               existing_nullable=False)
    op.alter_column('price_lists', 'is_active',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_comment='활성화 여부',
               existing_nullable=False)
    op.alter_column('push_tokens', 'platform',
               existing_type=sa.VARCHAR(length=10),
               server_default=None,
               existing_comment='플랫폼 (web, ios, android)',
               existing_nullable=False)
    op.alter_column('roles', 'access_level',
               existing_type=sa.VARCHAR(length=20),
               server_default=None,
               existing_nullable=False)

    # ── 10. subscription_history 컬럼 추가 ──
    _safe_add_column(conn, 'subscription_history', sa.Column('from_status', sa.String(length=20), nullable=True, comment='이전 상태 (상태 전이 시에만 기록)'))
    _safe_add_column(conn, 'subscription_history', sa.Column('to_status', sa.String(length=20), nullable=True, comment='변경된 상태 (상태 전이 시에만 기록)'))


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('subscription_history', 'to_status')
    op.drop_column('subscription_history', 'from_status')
    op.alter_column('roles', 'access_level',
               existing_type=sa.VARCHAR(length=20),
               server_default=sa.text("'own'::character varying"),
               existing_nullable=False)
    op.alter_column('push_tokens', 'platform',
               existing_type=sa.VARCHAR(length=10),
               server_default=sa.text("'web'::character varying"),
               existing_comment='플랫폼 (web, ios, android)',
               existing_nullable=False)
    op.alter_column('price_lists', 'is_active',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('true'),
               existing_comment='활성화 여부',
               existing_nullable=False)
    op.alter_column('price_lists', 'unit_price',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_comment='단가 (원)',
               existing_nullable=False)
    op.alter_column('notifications', 'priority',
               existing_type=sa.VARCHAR(length=20),
               comment='중요도 (important, normal)',
               existing_comment='중요도 (important: 인앱+외부채널, normal: 인앱만)',
               existing_nullable=False)
    op.alter_column('notification_settings', 'channel_alarmtalk',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_comment='카카오 알림톡 활성화',
               existing_nullable=False)
    op.alter_column('notification_settings', 'channel_push',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_comment='웹 푸시 활성화',
               existing_nullable=False)
    op.alter_column('notification_settings', 'channel_in_app',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('true'),
               existing_comment='인앱 알림 활성화',
               existing_nullable=False)
    op.alter_column('notification_settings', 'category',
               existing_type=sa.VARCHAR(length=30),
               comment='알림 대분류 (* = 전체)',
               existing_comment='알림 대분류 (assessment, counseling, system)',
               existing_nullable=False)
    op.add_column('members', sa.Column('permissions_version', sa.INTEGER(), server_default=sa.text('0'), autoincrement=False, nullable=False))
    op.alter_column('llm_calls', 'audio_duration_seconds',
               existing_type=sa.DOUBLE_PRECISION(precision=53),
               comment='STT 오디오 길이 (초, 분단위 과금용)',
               existing_nullable=True)
    op.alter_column('llm_calls', 'purpose',
               existing_type=sa.VARCHAR(length=50),
               comment='호출 용도 (skill_selection, field_note_stt_diarize 등)',
               existing_nullable=False)
    op.alter_column('llm_calls', 'source_id',
               existing_type=sa.VARCHAR(length=36),
               comment='출처 엔티티 ID (field_note_id 등)',
               existing_nullable=True)
    op.alter_column('llm_calls', 'source_type',
               existing_type=sa.VARCHAR(length=20),
               comment='호출 출처 (agent | field_note)',
               existing_nullable=False,
               existing_server_default=sa.text("'agent'::character varying"))
    op.alter_column('llm_calls', 'center_id',
               existing_type=sa.VARCHAR(length=36),
               comment='센터 ID (field_note 호출 시 직접 참조)',
               existing_nullable=True)
    op.alter_column('field_notes', 'processing_status',
               existing_type=sa.VARCHAR(length=20),
               comment='파이프라인 상태 (idle, processing, completed, failed)',
               existing_comment='파이프라인 상태 (idle, processing, completed, failed, skipped)',
               existing_nullable=False,
               existing_server_default=sa.text("'idle'::character varying"))
    op.alter_column('counseling_session_participants', 'attendance_status',
               existing_type=sa.VARCHAR(length=20),
               comment='참석 상태 (scheduled, attended, absent, late, excused)',
               existing_comment='참석 상태 (scheduled, attended, absent, late, excused, no_show)',
               existing_nullable=False)
    op.drop_index(op.f('ix_counseling_case_analyses_counseling_case_id'), table_name='counseling_case_analyses')
    op.drop_index(op.f('ix_counseling_case_analyses_center_id'), table_name='counseling_case_analyses')
    op.alter_column('counseling_case_analyses', 'deleted_at',
               existing_type=postgresql.TIMESTAMP(),
               comment=None,
               existing_comment='삭제 시각 (UTC, Soft Delete)',
               existing_nullable=True)
    op.alter_column('counseling_case_analyses', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               server_default=None,
               comment=None,
               existing_comment='수정 시각 (UTC)',
               existing_nullable=False)
    op.alter_column('counseling_case_analyses', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               server_default=None,
               comment=None,
               existing_comment='생성 시각 (UTC)',
               existing_nullable=False)
    op.alter_column('counseling_case_analyses', 'id',
               existing_type=sa.VARCHAR(length=36),
               comment=None,
               existing_comment='UUID Primary Key',
               existing_nullable=False)
    op.drop_index('uq_client_vouchers_case_client_active', table_name='client_vouchers', postgresql_where='deleted_at IS NULL AND case_id IS NOT NULL')
    op.drop_index('idx_client_vouchers_case', table_name='client_vouchers', postgresql_where='deleted_at IS NULL')
    op.drop_column('client_vouchers', 'case_id')
    op.drop_index(op.f('ix_center_note_preferences_center_id'), table_name='center_note_preferences')
    op.create_index(op.f('ix_center_note_preferences_center_id'), 'center_note_preferences', ['center_id'], unique=False)
    op.alter_column('center_note_preferences', 'deleted_at',
               existing_type=postgresql.TIMESTAMP(),
               comment=None,
               existing_comment='삭제 시각 (UTC, Soft Delete)',
               existing_nullable=True)
    op.alter_column('center_note_preferences', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               comment=None,
               existing_comment='수정 시각 (UTC)',
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('center_note_preferences', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               comment=None,
               existing_comment='생성 시각 (UTC)',
               existing_nullable=False,
               existing_server_default=sa.text('now()'))
    op.alter_column('billables', 'status',
               existing_type=sa.VARCHAR(length=20),
               server_default=sa.text("'draft'::character varying"),
               existing_comment='상태: draft, issued, paid, overdue',
               existing_nullable=False)
    op.alter_column('billables', 'unpaid_amount',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_comment='미수금 (= total - paid)',
               existing_nullable=False)
    op.alter_column('billables', 'paid_amount',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_comment='결제 금액 (= SUM(payments.amount))',
               existing_nullable=False)
    op.alter_column('billables', 'discount_amount',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_comment='청구서 전체 할인액 (묶음 할인 등)',
               existing_nullable=False)
    op.alter_column('billables', 'total_amount',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_comment='총 금액 (= SUM(items.amount) - discount_amount)',
               existing_nullable=False)
    op.drop_column('billables', 'subsidy_amount')
    op.drop_index('idx_billable_items_client_voucher', table_name='billable_items', postgresql_where='deleted_at IS NULL AND client_voucher_id IS NOT NULL')
    op.alter_column('billable_items', 'amount',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_comment='금액 (= quantity × unit_price)',
               existing_nullable=False)
    op.alter_column('billable_items', 'unit_price',
               existing_type=sa.INTEGER(),
               server_default=sa.text('0'),
               existing_comment='단가',
               existing_nullable=False)
    op.alter_column('billable_items', 'quantity',
               existing_type=sa.INTEGER(),
               server_default=sa.text('1'),
               existing_comment='수량',
               existing_nullable=False)
    op.alter_column('billable_items', 'related_session_id',
               existing_type=sa.VARCHAR(length=36),
               comment='연관 세션 ID (회차별 청구 추적용)',
               existing_comment='연관 세션 ID (회차별 청구 추적용 — 패키지 선결제는 세션별 1:1 매핑)',
               existing_nullable=True)
    op.alter_column('billable_items', 'related_type',
               existing_type=sa.VARCHAR(length=50),
               comment='연관 유형: counseling_session, assessment_session',
               existing_comment='연관 유형: counseling_session, counseling_case, assessment_session, assessment_case',
               existing_nullable=True)
    op.drop_column('billable_items', 'subsidy_amount')
    op.drop_column('billable_items', 'client_voucher_id')
    # NOTE: 테이블 재생성 코드 제거 — upgrade에서 drop하지 않으므로 downgrade에서 recreate 불필요
    # ### end Alembic commands ###
