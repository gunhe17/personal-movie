"""voucher_documents: replace content/source_site/fetched_at with content_file_path

Revision ID: d8e5b3a9c2f4
Revises: b2d4f9a8c6e1
Create Date: 2026-05-20 16:00:00.000000

본문 저장 방식을 인라인 Text(content)에서 S3 markdown 파일 경로(content_file_path)로
전환하고, 더 이상 사용하지 않는 source_site / fetched_at 컬럼을 제거한다.

⚠️ 데이터 손실:
- content (Text) 컬럼이 제거됩니다. 운영 환경에 인라인 본문이 남아 있다면
  본 마이그레이션 이전에 S3로 이관 후 content_file_path 백필이 필요합니다.
- source_site, fetched_at 컬럼이 제거됩니다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd8e5b3a9c2f4'
down_revision: Union[str, Sequence[str], None] = 'c3e7b1d9f4a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 새 컬럼: 가공된 markdown 본문 파일의 S3 경로
    op.add_column(
        'voucher_documents',
        sa.Column(
            'content_file_path',
            sa.String(length=512),
            nullable=True,
            comment='가공된 markdown 본문 파일 경로 (S3). 페이지 경계는 HTML 주석 마커로 표기',
        ),
    )

    # 더 이상 사용하지 않는 컬럼 제거 (데이터 손실)
    op.drop_column('voucher_documents', 'content')
    op.drop_column('voucher_documents', 'source_site')
    op.drop_column('voucher_documents', 'fetched_at')


def downgrade() -> None:
    # 컬럼 복원 (데이터는 복구 불가, 빈 컬럼만 다시 생성)
    op.add_column(
        'voucher_documents',
        sa.Column(
            'fetched_at',
            sa.DateTime(timezone=False),
            nullable=True,
            comment='원본 취득 시각 (UTC)',
        ),
    )
    op.add_column(
        'voucher_documents',
        sa.Column(
            'source_site',
            sa.String(length=255),
            nullable=True,
            comment='원본 취득 site',
        ),
    )
    op.add_column(
        'voucher_documents',
        sa.Column(
            'content',
            sa.Text(),
            nullable=True,
            comment='변환된 본문 (markdown). 페이지 경계는 HTML 주석 마커로 표기',
        ),
    )

    op.drop_column('voucher_documents', 'content_file_path')
