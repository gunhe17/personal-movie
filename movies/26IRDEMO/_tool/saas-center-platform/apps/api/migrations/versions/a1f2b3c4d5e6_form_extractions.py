"""form_extractions — 서식(이미지/PDF 1페이지) → form_template 추출 잡

Revision ID: a1f2b3c4d5e6
Revises: 343712ca5977
Create Date: 2026-06-11 02:30:00.000000

설계(docs/form-extraction-flow.html):
- voucher_extractions 의 평행 이식. 입력은 서식 1장(업로드/기존 문서),
  산출은 PNG 1장(image_document_id) + FormSchema draft(completed).
- form 모듈 테이블은 마이그레이션 이력 없이 create_all 로 관리되어 왔으므로
  존재 가드로 어떤 상태에서도 안전하게 동작한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1f2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '343712ca5977'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, name: str) -> bool:
    return conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:n"
    ), {"n": name}).scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "form_extractions"):
        return

    op.create_table(
        'form_extractions',
        sa.Column('status', sa.String(length=20), server_default='started', nullable=False, comment='가공 상태: started / completed / failed'),
        sa.Column('name', sa.String(length=100), nullable=False, comment='만들 form_template 의 기본 이름'),
        sa.Column('center_id', sa.String(length=36), nullable=True, comment='귀속 센터 (NULL = 시스템 템플릿)'),
        sa.Column('started_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='가공 시작 시각 (UTC). latency 기준점'),
        sa.Column('completed_at', sa.DateTime(), nullable=True, comment='가공 완료 시각 (UTC). latency = completed_at − started_at'),
        sa.Column('failed_at', sa.DateTime(), nullable=True, comment='가공 실패 시각 (UTC)'),
        sa.Column('source_document_id', sa.String(length=36), nullable=False, comment='입력 원본 global_document id'),
        sa.Column('page_range', postgresql.INT4RANGE(), nullable=True, comment='source 가 다중 페이지 PDF 일 때 서식 위치 (단일 페이지로 해석)'),
        sa.Column('image_document_id', sa.String(length=36), nullable=True, comment='가공 산출 서식 PNG global_document id (배경)'),
        sa.Column('completed', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='성공 결과 = FormSchema draft {pages, fields, elements}'),
        sa.Column('failed', sa.Text(), nullable=True, comment='실패 사유. status=failed 일 때만 의미 있음'),
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_form_extractions_status', 'form_extractions', ['status'], unique=False)
    op.create_index('ix_form_extractions_center', 'form_extractions', ['center_id'], unique=False)
    op.create_index('ix_form_extractions_deleted_at', 'form_extractions', ['deleted_at'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "form_extractions"):
        op.drop_table('form_extractions')
