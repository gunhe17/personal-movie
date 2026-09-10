"""voucher: global_documents + voucher_documents + voucher_extractions (구 voucher_drafts)
            + 구 voucher_files / voucher_file_links 제거

Revision ID: 64de47b4b2ce
Revises: f7a3c1d9e2b8
Create Date: 2026-06-10 16:39:27.341602

수동 작성: autogenerate 가 이 환경의 광범위한 모델/DB drift 를 함께 잡으나 본 작업과
무관하므로 제외하고, voucher 문서 흐름 재설계 범위만 포함한다.

존재/형상 가드: 개발 서버 DB 는 create_all 로 초기화된 적이 있어(init-schema 신규 DB
경로) 이 마이그레이션의 대상 테이블이 이미 존재할 수 있고, **리디자인 중간 단계**의
모델로 만들어져 형상이 다를 수도 있다(예: voucher_documents 에 global_document_id 가
없는 변형). 세 테이블은 이 리비전이 처음 도입하는 신규 테이블이라 — 기존 변형은
중간 빌드 산물일 수밖에 없으므로 — 기대 컬럼셋과 다르면 drop 후 재생성한다(greenfield).

설계(docs/voucher-document-flow.html):
- global_documents: 기존 documents 형태(− access_level·center_id), group_code 없음. tenant 없음.
- voucher_documents: voucher ↔ global_document 영속 링크 (voucher_file_links 대체).
- voucher_extractions: 구 voucher_drafts 재정의 — status started/completed/failed +
  상태별 _at, completed(JSONB)/failed(Text)/document_ids. greenfield 이므로 drop+create.
- voucher_files / voucher_file_links: global_documents / voucher_documents 로 대체 — 제거.
- voucher_forms: 이번 범위 제외(미변경) — file_id 그대로 둠(추후 global_document_id 재연결).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '64de47b4b2ce'
down_revision: Union[str, Sequence[str], None] = 'f7a3c1d9e2b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    return conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:n"
    ), {"n": name}).scalar() is not None


def _index_exists(conn, name: str) -> bool:
    return conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname=:n"
    ), {"n": name}).scalar() is not None


def _create_index_if_missing(conn, name: str, table: str, columns: list[str]) -> None:
    if not _index_exists(conn, name):
        op.create_index(name, table, columns, unique=False)


def _columns(conn, table: str) -> set[str]:
    rows = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=:t"
    ), {"t": table}).scalars().all()
    return set(rows)


# 이 리비전이 도입하는 신규 테이블의 기대 컬럼셋 — 형상이 다르면 중간 빌드 산물로
# 보고 drop+재생성한다.
_EXPECTED_COLUMNS: dict[str, set[str]] = {
    "global_documents": {
        "uploader_id", "name", "original_name", "description", "storage_path",
        "file_type", "file_size", "checksum",
        "id", "created_at", "updated_at", "deleted_at",
    },
    "voucher_documents": {
        "voucher_id", "global_document_id", "page_range",
        "id", "created_at", "updated_at", "deleted_at",
    },
    "voucher_extractions": {
        "status", "started_at", "completed_at", "failed_at",
        "document_ids", "completed", "failed",
        "id", "created_at", "updated_at", "deleted_at",
    },
}


def _needs_recreate(conn, table: str) -> bool:
    """존재하지만 기대 형상과 다른 테이블 — 중간 단계 create_all 산물."""
    if not _table_exists(conn, table):
        return False
    return _columns(conn, table) != _EXPECTED_COLUMNS[table]


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # --- global_documents (신규, documents 형태 − access_level·center_id) ---
    if _needs_recreate(conn, 'global_documents'):
        op.drop_table('global_documents')
    if not _table_exists(conn, 'global_documents'):
        op.create_table(
            'global_documents',
            sa.Column('uploader_id', sa.String(length=36), nullable=True, comment='업로더 UUID (FK 제약 없음)'),
            sa.Column('name', sa.String(length=255), nullable=False, comment='문서명 (대표명)'),
            sa.Column('original_name', sa.String(length=255), nullable=True, comment='원본 파일명'),
            sa.Column('description', sa.Text(), nullable=True, comment='설명'),
            sa.Column('storage_path', sa.String(length=512), nullable=False, comment='스토리지 경로 (S3 key)'),
            sa.Column('file_type', sa.String(length=100), nullable=False, comment='확장자/타입 (pdf·hwpx·md ...)'),
            sa.Column('file_size', sa.BigInteger(), nullable=False, comment='파일 크기 (bytes)'),
            sa.Column('checksum', sa.String(length=64), nullable=True, comment='SHA-256 (계산 가능 시)'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('storage_path'),
        )
    _create_index_if_missing(conn, 'ix_global_documents_deleted_at', 'global_documents', ['deleted_at'])
    _create_index_if_missing(conn, 'ix_global_documents_uploader', 'global_documents', ['uploader_id'])

    # --- voucher_documents (신규, voucher_file_links 대체) ---
    if _needs_recreate(conn, 'voucher_documents'):
        op.drop_table('voucher_documents')
    if not _table_exists(conn, 'voucher_documents'):
        op.create_table(
            'voucher_documents',
            sa.Column('voucher_id', sa.String(length=36), nullable=False, comment='vouchers.id 참조 (UUID, FK 제약 없음)'),
            sa.Column('global_document_id', sa.String(length=36), nullable=False, comment='global_documents.id 참조 (UUID, FK 제약 없음)'),
            sa.Column('page_range', postgresql.INT4RANGE(), nullable=True, comment='자료 내에서 이 voucher 에 해당하는 인쇄 페이지 범위'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('voucher_id', 'global_document_id', name='uq_voucher_document'),
        )
    _create_index_if_missing(conn, 'ix_voucher_documents_global_document', 'voucher_documents', ['global_document_id'])
    _create_index_if_missing(conn, 'ix_voucher_documents_voucher', 'voucher_documents', ['voucher_id'])

    # --- voucher_drafts → voucher_extractions (재정의: greenfield drop + create) ---
    if _table_exists(conn, 'voucher_drafts'):
        op.drop_table('voucher_drafts')
    if _needs_recreate(conn, 'voucher_extractions'):
        op.drop_table('voucher_extractions')
    if not _table_exists(conn, 'voucher_extractions'):
        op.create_table(
            'voucher_extractions',
            sa.Column('status', sa.String(length=20), server_default='started', nullable=False, comment='변환 상태: started / completed / failed'),
            sa.Column('started_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='변환 시작 시각 (UTC). latency 기준점'),
            sa.Column('completed_at', sa.DateTime(), nullable=True, comment='변환 완료 시각 (UTC). latency = completed_at − started_at'),
            sa.Column('failed_at', sa.DateTime(), nullable=True, comment='변환 실패 시각 (UTC)'),
            sa.Column('document_ids', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False, comment='입력 global_document id 목록 (pdf·hwpx + 가공 md)'),
            sa.Column('completed', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='성공 결과 {type, source_url, vouchers:[...]} (구 data)'),
            sa.Column('failed', sa.Text(), nullable=True, comment='실패 사유 (구 error)'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
    _create_index_if_missing(conn, 'ix_voucher_extractions_status', 'voucher_extractions', ['status'])
    _create_index_if_missing(conn, 'ix_voucher_extractions_deleted_at', 'voucher_extractions', ['deleted_at'])

    # --- 구 모듈 제거 (drop_table 이 종속 인덱스/제약 함께 제거) ---
    if _table_exists(conn, 'voucher_file_links'):
        op.drop_table('voucher_file_links')
    if _table_exists(conn, 'voucher_files'):
        op.drop_table('voucher_files')


def downgrade() -> None:
    """Downgrade schema — 구 voucher_files / voucher_file_links / voucher_drafts 복원."""
    conn = op.get_bind()
    # --- voucher_files 복원 ---
    op.create_table(
        'voucher_files',
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=30), nullable=False),
        sa.Column('content_file_path', sa.String(length=512), nullable=True),
        sa.Column('source_url', sa.String(length=1024), nullable=True),
        sa.Column('files', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('extraction_status', sa.String(length=20), server_default='idle', nullable=False),
        sa.Column('extraction_error', sa.Text(), nullable=True),
        sa.Column('extraction_started_at', sa.DateTime(), nullable=True),
        sa.Column('extraction_completed_at', sa.DateTime(), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_voucher_files_type', 'voucher_files', ['type'], unique=False)
    op.create_index('ix_voucher_files_deleted_at', 'voucher_files', ['deleted_at'], unique=False)
    op.create_index('ix_voucher_files_extraction_status', 'voucher_files', ['extraction_status'], unique=False)

    # --- voucher_file_links 복원 ---
    op.create_table(
        'voucher_file_links',
        sa.Column('voucher_id', sa.String(length=36), nullable=False),
        sa.Column('file_id', sa.String(length=36), nullable=False),
        sa.Column('page_range', postgresql.INT4RANGE(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('voucher_id', 'file_id', name='uq_voucher_file_link'),
    )
    op.create_index('ix_voucher_file_links_voucher', 'voucher_file_links', ['voucher_id'], unique=False)
    op.create_index('ix_voucher_file_links_file', 'voucher_file_links', ['file_id'], unique=False)

    # --- voucher_extractions → voucher_drafts 복원 ---
    if _table_exists(conn, 'voucher_extractions'):
        op.drop_table('voucher_extractions')
    op.create_table(
        'voucher_drafts',
        sa.Column('status', sa.String(length=20), server_default='pending', nullable=False, comment='pending / confirmed / rejected'),
        sa.Column('kind', sa.String(length=20), server_default='voucher', nullable=False),
        sa.Column('file_id', sa.String(length=36), server_default='', nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=True),
        sa.Column('confirmed_voucher_id', sa.String(length=36), nullable=True),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_voucher_drafts_file', 'voucher_drafts', ['file_id'], unique=False)
    op.create_index('ix_voucher_drafts_kind', 'voucher_drafts', ['kind'], unique=False)

    # --- 신규 테이블 제거 ---
    if _table_exists(conn, 'voucher_documents'):
        op.drop_table('voucher_documents')
    if _table_exists(conn, 'global_documents'):
        op.drop_table('global_documents')
