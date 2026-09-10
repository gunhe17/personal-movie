"""voucher_extractions.document_ids → source/artifact 두 리스트 분리

Revision ID: c3a7e1f9b2d4
Revises: f1a9c7d3b5e2
Create Date: 2026-06-11 00:30:00.000000

설계 변경: 입력 원본(pdf·hwpx 등)과 산출/가공물(가공 md, 제출용 서식 png 등)을
하나의 document_ids 배열에 뭉쳐두던 것을 의미에 따라 두 리스트로 분리한다.
  - source_document_ids:   업로드 원본
  - artifact_document_ids: 가공 산출물 (md, png ...)
백필은 기존 document_ids 의 각 id 를 global_documents.file_type 으로 분류한다
(md/markdown/png → artifact, 그 외/미해석 → source). 순서는 보존한다.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3a7e1f9b2d4"
down_revision: Union[str, Sequence[str], None] = "f1a9c7d3b5e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_ARTIFACT_TYPES = "('md','markdown','png')"

# 기존 document_ids 의 각 멤버를 file_type 으로 분류해 한쪽 리스트로 모으는 백필.
# - ORDINALITY 로 원래 순서 보존.
# - LEFT JOIN: global_document 가 사라진(orphan) id 는 file_type IS NULL → source 로 보존.
_BACKFILL_SQL = f"""
UPDATE voucher_extractions ve SET
    source_document_ids = COALESCE((
        SELECT jsonb_agg(t.elem ORDER BY t.ord)
        FROM jsonb_array_elements_text(ve.document_ids)
             WITH ORDINALITY AS t(elem, ord)
        LEFT JOIN global_documents d ON d.id = t.elem
        WHERE d.file_type IS NULL
           OR lower(d.file_type) NOT IN {_ARTIFACT_TYPES}
    ), '[]'::jsonb),
    artifact_document_ids = COALESCE((
        SELECT jsonb_agg(t.elem ORDER BY t.ord)
        FROM jsonb_array_elements_text(ve.document_ids)
             WITH ORDINALITY AS t(elem, ord)
        LEFT JOIN global_documents d ON d.id = t.elem
        WHERE lower(d.file_type) IN {_ARTIFACT_TYPES}
    ), '[]'::jsonb)
"""

_DOWNGRADE_BACKFILL_SQL = """
UPDATE voucher_extractions SET document_ids =
    COALESCE(source_document_ids, '[]'::jsonb)
    || COALESCE(artifact_document_ids, '[]'::jsonb)
"""


def _has_column(conn, table: str, col: str) -> bool:
    return any(c["name"] == col for c in sa.inspect(conn).get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()

    if not _has_column(conn, "voucher_extractions", "source_document_ids"):
        op.add_column(
            "voucher_extractions",
            sa.Column(
                "source_document_ids",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
                comment="입력 원본 global_document id (업로드 원본: pdf·hwpx 등)",
            ),
        )
    if not _has_column(conn, "voucher_extractions", "artifact_document_ids"):
        op.add_column(
            "voucher_extractions",
            sa.Column(
                "artifact_document_ids",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
                comment="산출/가공 global_document id (가공 md, 제출용 서식 png 등)",
            ),
        )

    # 기존 데이터 백필 후 구 컬럼 제거 (document_ids 가 아직 있을 때만)
    if _has_column(conn, "voucher_extractions", "document_ids"):
        op.execute(_BACKFILL_SQL)
        op.drop_column("voucher_extractions", "document_ids")


def downgrade() -> None:
    conn = op.get_bind()

    if not _has_column(conn, "voucher_extractions", "document_ids"):
        op.add_column(
            "voucher_extractions",
            sa.Column(
                "document_ids",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
                comment="입력 global_document id 목록 (pdf·hwpx + 가공 md)",
            ),
        )
        op.execute(_DOWNGRADE_BACKFILL_SQL)

    for col in ("artifact_document_ids", "source_document_ids"):
        if _has_column(conn, "voucher_extractions", col):
            op.drop_column("voucher_extractions", col)
