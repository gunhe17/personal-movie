"""form rename to forms and form_values, add audit/group_index/template status

Revision ID: 343712ca5977
Revises: 64de47b4b2ce
Create Date: 2026-06-11 01:31:59.289908

데이터 보존 마이그레이션 (form 모듈 테이블은 마이그레이션 이력이 없어 create_all 로 관리됨 →
존재 가드로 어떤 상태에서도 안전하게 동작):
- form_instances  → forms          (+ created_by, submitted_by)
- form_answers    → form_values     (question_id→field_key, answer→value, +group_index, UNIQUE 재정의)
- form_templates  + status (draft|published)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '343712ca5977'
down_revision: Union[str, Sequence[str], None] = '64de47b4b2ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    return conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:n"
    ), {"n": name}).scalar() is not None


def _column_exists(conn, table: str, column: str) -> bool:
    return conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column}).scalar() is not None


def _index_exists(conn, name: str) -> bool:
    return conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname=:n"
    ), {"n": name}).scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # ───────────────── forms (구 form_instances) ─────────────────
    if _table_exists(conn, "form_instances") and not _table_exists(conn, "forms"):
        op.rename_table("form_instances", "forms")
    # PG 는 테이블 rename 후에도 index 이름을 유지 → 수동 rename
    if _index_exists(conn, "ix_form_instances_center_status"):
        op.execute("ALTER INDEX ix_form_instances_center_status RENAME TO ix_forms_center_status")
    if _index_exists(conn, "ix_form_instances_template"):
        op.execute("ALTER INDEX ix_form_instances_template RENAME TO ix_forms_template")
    if _table_exists(conn, "forms"):
        if not _column_exists(conn, "forms", "created_by"):
            op.add_column("forms", sa.Column(
                "created_by", sa.String(length=36), nullable=True,
                comment="작성 시작자 (person_id)",
            ))
        if not _column_exists(conn, "forms", "submitted_by"):
            op.add_column("forms", sa.Column(
                "submitted_by", sa.String(length=36), nullable=True,
                comment="최종 제출자 (person_id, 제출 시 set)",
            ))

    # ───────────────── form_values (구 form_answers) ─────────────────
    if _table_exists(conn, "form_answers") and not _table_exists(conn, "form_values"):
        op.rename_table("form_answers", "form_values")
    if _table_exists(conn, "form_values"):
        if _column_exists(conn, "form_values", "question_id") and not _column_exists(conn, "form_values", "field_key"):
            op.alter_column("form_values", "question_id", new_column_name="field_key")
        if _column_exists(conn, "form_values", "answer") and not _column_exists(conn, "form_values", "value"):
            op.alter_column("form_values", "answer", new_column_name="value")
        if not _column_exists(conn, "form_values", "group_index"):
            op.add_column("form_values", sa.Column(
                "group_index", sa.Integer(), nullable=False, server_default="0",
                comment="반복 섹션 인덱스 (default 0)",
            ))
        if _index_exists(conn, "ix_form_answers_instance"):
            op.execute("ALTER INDEX ix_form_answers_instance RENAME TO ix_form_values_instance")
        if _index_exists(conn, "ix_form_answers_center"):
            op.execute("ALTER INDEX ix_form_answers_center RENAME TO ix_form_values_center")
        # UNIQUE 재정의: (instance_id, question_id) → (instance_id, field_key, group_index)
        if _index_exists(conn, "uq_form_answers_instance_question"):
            op.drop_index("uq_form_answers_instance_question", table_name="form_values")
        if not _index_exists(conn, "uq_form_values_instance_field_group"):
            op.create_index(
                "uq_form_values_instance_field_group", "form_values",
                ["instance_id", "field_key", "group_index"], unique=True,
            )

    # ───────────────── form_templates.status ─────────────────
    if _table_exists(conn, "form_templates") and not _column_exists(conn, "form_templates", "status"):
        op.add_column("form_templates", sa.Column(
            "status", sa.String(length=20), nullable=False, server_default="draft",
            comment="상태 (draft | published)",
        ))


def downgrade() -> None:
    conn = op.get_bind()

    # form_templates.status
    if _column_exists(conn, "form_templates", "status"):
        op.drop_column("form_templates", "status")

    # form_values → form_answers
    if _table_exists(conn, "form_values"):
        if _index_exists(conn, "uq_form_values_instance_field_group"):
            op.drop_index("uq_form_values_instance_field_group", table_name="form_values")
        if _column_exists(conn, "form_values", "group_index"):
            op.drop_column("form_values", "group_index")
        if _column_exists(conn, "form_values", "value") and not _column_exists(conn, "form_values", "answer"):
            op.alter_column("form_values", "value", new_column_name="answer")
        if _column_exists(conn, "form_values", "field_key") and not _column_exists(conn, "form_values", "question_id"):
            op.alter_column("form_values", "field_key", new_column_name="question_id")
        if _index_exists(conn, "ix_form_values_instance"):
            op.execute("ALTER INDEX ix_form_values_instance RENAME TO ix_form_answers_instance")
        if _index_exists(conn, "ix_form_values_center"):
            op.execute("ALTER INDEX ix_form_values_center RENAME TO ix_form_answers_center")
        if not _index_exists(conn, "uq_form_answers_instance_question"):
            op.create_index(
                "uq_form_answers_instance_question", "form_values",
                ["instance_id", "question_id"], unique=True,
            )
        if not _table_exists(conn, "form_answers"):
            op.rename_table("form_values", "form_answers")

    # forms → form_instances
    if _table_exists(conn, "forms"):
        if _column_exists(conn, "forms", "submitted_by"):
            op.drop_column("forms", "submitted_by")
        if _column_exists(conn, "forms", "created_by"):
            op.drop_column("forms", "created_by")
        if _index_exists(conn, "ix_forms_center_status"):
            op.execute("ALTER INDEX ix_forms_center_status RENAME TO ix_form_instances_center_status")
        if _index_exists(conn, "ix_forms_template"):
            op.execute("ALTER INDEX ix_forms_template RENAME TO ix_form_instances_template")
        if not _table_exists(conn, "form_instances"):
            op.rename_table("forms", "form_instances")
