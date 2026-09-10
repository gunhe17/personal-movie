"""voucher_files: file_path/original_filename → files JSONB slots

같은 자료의 여러 확장자(PDF/HWPX 등)를 한 row 의 JSONB dict 슬롯으로 묶어 관리.

변경:
  1. `files` JSONB 컬럼 신설 (server_default='{}')
  2. 기존 row 데이터 이관:
       file_path IS NOT NULL → 확장자 추출 → files = {<ext>: {file_path, content_type:null, size:null}}
       확장자는 original_filename 우선, 없으면 file_path에서 추출, 그것도 없으면 'bin'
  3. partial unique index `uq_voucher_files_active_original_filename` 제거
  4. `original_filename`, `file_path` 컬럼 제거

Revision ID: c1e8d4f2a9b6
Revises: a4f9c2b18e07
Create Date: 2026-05-27 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c1e8d4f2a9b6"
down_revision: Union[str, Sequence[str], None] = "a4f9c2b18e07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:table AND column_name=:column"
    ), {"table": table, "column": column})
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. files JSONB 컬럼 추가 (NOT NULL, default '{}')
    if not _column_exists(conn, "voucher_files", "files"):
        op.add_column(
            "voucher_files",
            sa.Column(
                "files",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
                comment=(
                    "확장자별 원본 파일 슬롯. "
                    "{<ext>: {file_path, content_type, size}}"
                ),
            ),
        )

    # 2. 기존 데이터 이관 — file_path 가 있는 row 만 (컬럼이 아직 존재할 때만)
    if _column_exists(conn, "voucher_files", "file_path"):
        op.execute(
            """
            UPDATE voucher_files
            SET files = jsonb_build_object(
                COALESCE(
                    NULLIF(lower(substring(original_filename FROM '\\.([^.]+)$')), ''),
                    NULLIF(lower(substring(file_path        FROM '\\.([^.]+)$')), ''),
                    'bin'
                ),
                jsonb_build_object(
                    'file_path',    file_path,
                    'content_type', NULL,
                    'size',         NULL
                )
            )
            WHERE file_path IS NOT NULL
            """
        )

    # 3. partial unique index 제거 (존재할 때만)
    op.execute(
        "DROP INDEX IF EXISTS uq_voucher_files_active_original_filename"
    )

    # 4. 컬럼 제거 (존재할 때만)
    if _column_exists(conn, "voucher_files", "original_filename"):
        op.drop_column("voucher_files", "original_filename")
    if _column_exists(conn, "voucher_files", "file_path"):
        op.drop_column("voucher_files", "file_path")


def downgrade() -> None:
    # 컬럼 복원
    op.add_column(
        "voucher_files",
        sa.Column(
            "file_path",
            sa.String(length=512),
            nullable=True,
            comment="객체 스토리지 원본 파일 경로",
        ),
    )
    op.add_column(
        "voucher_files",
        sa.Column(
            "original_filename",
            sa.String(length=255),
            nullable=True,
            comment=(
                "업로드 시점의 원본 파일명 (확장자 포함). "
                "중복 업로드 차단·표시 용도. 활성 row 대상 partial unique."
            ),
        ),
    )

    # 데이터 역이관 — files dict 의 임의 슬롯 1개 선택
    # (dict 키 순서가 보장되지 않으므로 jsonb_object_keys 의 첫 키 사용)
    op.execute(
        """
        UPDATE voucher_files vf
        SET
            file_path = (vf.files -> k.ext ->> 'file_path'),
            original_filename = NULL
        FROM (
            SELECT id, (jsonb_object_keys(files))[1] AS ext
            FROM voucher_files
            WHERE files <> '{}'::jsonb
        ) k
        WHERE vf.id = k.id
        """
    )

    # partial unique index 복원
    op.execute(
        """
        CREATE UNIQUE INDEX uq_voucher_files_active_original_filename
        ON voucher_files (original_filename)
        WHERE deleted_at IS NULL AND original_filename IS NOT NULL
        """
    )

    # files 컬럼 제거
    op.drop_column("voucher_files", "files")
