"""migrate main to branch schema (renames, cols, tables, enum data, payment backfill)

Revision ID: 4e49873c4e21
Revises: 1818f2c3637c
Create Date: 2026-07-13 14:00:41.384924

origin/main(head 1818f2c3637c) → 현 브랜치 코드 스키마로의 단일 전환 마이그.
컬럼 리네임(데이터 보존) + 컬럼 추가/삭제 + person_profiles 생성 + 死테이블 drop
+ enum 값 데이터 정규화 + payment_records→billables 백필.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4e49873c4e21'
down_revision: Union[str, Sequence[str], None] = '1818f2c3637c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, old, new) — 인터페이스 리네임(타입 보존, ALTER RENAME)
RENAMES = [
    ("agent_messages", "type", "message_type"),
    ("agent_runs", "type", "run_type"),
    ("assessments", "type", "assessment_type"),
    ("assessment_send_links", "expired_at", "expires_at"),
    ("assessment_send_results", "expired_at", "expires_at"),
    ("billables", "notes", "memo"),
    ("billable_items", "notes", "memo"),
    ("payments", "notes", "memo"),
    ("price_lists", "notes", "memo"),
    ("center_vouchers", "notes", "memo"),
    ("schedules", "note", "memo"),
    ("counseling_session_participants", "note", "memo"),
    ("client_link_requests", "processed_at", "reviewed_at"),
    ("counseling_case_participants", "role", "participant_type"),
    ("llm_calls", "error", "error_message"),
    ("login_notifications", "notification_error", "error_message"),
    ("member_invitations", "membered_at", "accepted_at"),
    ("subscription_history", "changed_by", "actor_type"),
    ("person_credentials", "kind", "credential_type"),
    ("person_credentials", "verification_status", "status"),
    ("person_credentials", "verification_reject_reason", "reject_reason"),
    ("person_credentials", "verification_requested_at", "requested_at"),
    ("person_credentials", "verification_reviewed_at", "reviewed_at"),
    ("person_credentials", "verification_reviewed_by", "reviewed_by"),
]


def upgrade() -> None:
    # A. 컬럼 리네임 (데이터 보존)
    for table, old, new in RENAMES:
        op.alter_column(table, old, new_column_name=new)

    # B. 컬럼 추가 (NOT NULL은 server_default로 기존 행 채움)
    op.add_column("events", sa.Column("actor_type", sa.String(20), nullable=False, server_default="member"))
    op.add_column("events", sa.Column("ip_address", sa.String(45), nullable=True))
    op.add_column("counseling_case_analyses", sa.Column("status", sa.String(20), nullable=False, server_default="completed"))
    op.add_column("counseling_case_analyses", sa.Column("error_message", sa.String(500), nullable=True))
    op.add_column("message_logs", sa.Column("form_send_id", sa.String(36), nullable=True))
    op.add_column("non_operating_times", sa.Column("is_system_registered", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    # C. 컬럼 삭제
    op.drop_column("billables", "notification_sent_at")
    op.drop_column("cs_memos", "created_by_name")
    op.drop_column("inquiries", "answered_by_name")

    # C-2. 컬럼 타입/nullable 변경 (String(10)→(36): 10자 칸에 36자 account_id 못 담던 것)
    op.alter_column("non_operating_times", "created_by",
                    existing_type=sa.String(10), type_=sa.String(36),
                    existing_nullable=False, nullable=True)

    # D. person_profiles 신규 테이블
    op.create_table(
        "person_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("center_id", sa.String(36), nullable=False),
        sa.Column("member_id", sa.String(36), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("analyzed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_person_profiles_center_id", "person_profiles", ["center_id"])
    op.create_index("ix_person_profiles_member_id", "person_profiles", ["member_id"])

    # E. 死테이블 drop (main head 존재 불확실 → IF EXISTS로 안전)
    op.execute("DROP TABLE IF EXISTS admin_audit_logs")
    op.execute("DROP TABLE IF EXISTS agent_intent_templates")

    # F. enum 값 데이터 정규화 — 제거된 값 가진 옛 행이 read(enum 검증)에서 500 나지 않게
    #    billables: overdue(연체)만 실제 발생 가능 → issued(미납)로. draft는 생성 경로 없어 0행.
    op.execute("UPDATE billables SET status = 'issued' WHERE status = 'overdue'")
    op.execute("UPDATE form_extractions SET status = 'processing' WHERE status = 'started'")
    op.execute("UPDATE voucher_extractions SET status = 'processing' WHERE status = 'started'")
    op.execute("UPDATE assessment_sessions SET status = 'no_show' WHERE status = 'noshow'")

    # G. payment_records → billables + billable_items(+payments) 백필
    #    billable.id = payment_record.id (1:1) — 멱등·역전이. 구 테이블 보존.
    op.execute(
        """
        INSERT INTO billables (
            id, center_id, client_id, billable_date, total_amount,
            discount_amount, subsidy_amount, paid_amount, unpaid_amount, status,
            issued_at, due_date, memo, created_by, created_at, updated_at, deleted_at
        )
        SELECT pr.id, pr.center_id, pr.client_id, pr.issued_at::date, pr.amount, 0, 0,
            CASE WHEN pr.status = 'completed' THEN pr.amount ELSE 0 END,
            CASE WHEN pr.status = 'completed' THEN 0 ELSE pr.amount END,
            CASE WHEN pr.status = 'completed' THEN 'paid' ELSE 'issued' END,
            pr.issued_at, NULL, pr.note, pr.created_by,
            pr.created_at, pr.updated_at, pr.deleted_at
        FROM payment_records pr
        WHERE NOT EXISTS (SELECT 1 FROM billables b WHERE b.id = pr.id)
        """
    )
    op.execute(
        """
        INSERT INTO billable_items (
            id, billable_id, item_type, item_id, related_type,
            related_case_id, related_session_id, client_voucher_id, price_list_id,
            description, quantity, unit_price, amount, subsidy_amount, provided_at, memo,
            created_at, updated_at, deleted_at
        )
        SELECT gen_random_uuid()::varchar(36), pr.id, 'service', NULL, pr.related_type,
            CASE WHEN pr.related_type LIKE '%\\_case' THEN pr.related_id END,
            CASE WHEN pr.related_type LIKE '%\\_session' THEN pr.related_id END,
            NULL, NULL, pr.description, 1, pr.amount, pr.amount, 0, NULL, pr.billing_code,
            pr.created_at, pr.updated_at, pr.deleted_at
        FROM payment_records pr
        WHERE NOT EXISTS (SELECT 1 FROM billable_items bi WHERE bi.billable_id = pr.id)
        """
    )
    op.execute(
        """
        INSERT INTO payments (
            id, billable_id, amount, payment_method, paid_at,
            receipt_number, memo, created_by, created_at, updated_at, deleted_at
        )
        SELECT gen_random_uuid()::varchar(36), pr.id, pr.amount, 'legacy', pr.completed_at,
            NULL, NULL, COALESCE(pr.completed_by, pr.created_by),
            pr.created_at, pr.updated_at, pr.deleted_at
        FROM payment_records pr
        WHERE pr.status = 'completed' AND pr.completed_at IS NOT NULL AND pr.amount > 0
          AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.billable_id = pr.id)
        """
    )


def downgrade() -> None:
    # G. 백필 제거
    op.execute("DELETE FROM payments WHERE billable_id IN (SELECT id FROM payment_records)")
    op.execute("DELETE FROM billable_items WHERE billable_id IN (SELECT id FROM payment_records)")
    op.execute("DELETE FROM billables WHERE id IN (SELECT id FROM payment_records)")

    # E. 死테이블 복구 (best-effort — 데이터는 복원 불가)
    op.create_table(
        "admin_audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("admin_account_id", sa.String(36), nullable=False),
        sa.Column("admin_email", sa.String(200), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", sa.String(36), nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("extra", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "agent_intent_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("center_id", sa.String(36), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding_vector", postgresql.JSONB(), nullable=True),
        sa.Column("tool_config", postgresql.JSONB(), nullable=True),
        sa.Column("response_template", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
    )

    # D. person_profiles 제거
    op.drop_table("person_profiles")

    # C-2. 타입/nullable 역전 (best-effort — 36자 값/NULL 있으면 실패 가능)
    op.alter_column("non_operating_times", "created_by",
                    existing_type=sa.String(36), type_=sa.String(10),
                    existing_nullable=True, nullable=False)

    # C. 삭제 컬럼 복구
    op.add_column("inquiries", sa.Column("answered_by_name", sa.String(100), nullable=True))
    op.add_column("cs_memos", sa.Column("created_by_name", sa.String(100), nullable=True))
    op.add_column("billables", sa.Column("notification_sent_at", sa.DateTime(timezone=False), nullable=True))

    # B. 추가 컬럼 제거
    op.drop_column("non_operating_times", "is_system_registered")
    op.drop_column("message_logs", "form_send_id")
    op.drop_column("counseling_case_analyses", "error_message")
    op.drop_column("counseling_case_analyses", "status")
    op.drop_column("events", "ip_address")
    op.drop_column("events", "actor_type")

    # A. 리네임 역전
    for table, old, new in RENAMES:
        op.alter_column(table, new, new_column_name=old)
