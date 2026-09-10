"""add person_credentials table

학력·경력·자격을 통합한 person_credentials 테이블 생성.
플랫폼 어드민이 검증하며, kind 컬럼으로 종류를 구분.

설계 문서: docs/center/member-credentials.md

Revision ID: b7e9f3a2c8d1
Revises: affa1878dacf
Create Date: 2026-05-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b7e9f3a2c8d1'
down_revision: Union[str, Sequence[str], None] = 'affa1878dacf'
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


def upgrade() -> None:
    """Create person_credentials table."""
    if not _table_exists('person_credentials'):
        op.create_table(
            'person_credentials',
            # BaseModel 공통 컬럼
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),

            # 소유자 + 종류
            sa.Column('person_id', sa.String(length=36), nullable=False, comment='소유자 Person id'),
            sa.Column('kind', sa.String(length=20), nullable=False, comment='종류 (education | career | certification)'),

            # 공통 표시 필드
            sa.Column('title', sa.String(length=200), nullable=False, comment='제목 (학위명/직책명/자격증명)'),
            sa.Column('organization', sa.String(length=200), nullable=False, comment='소속 기관 (학교/회사/발급기관)'),
            sa.Column('description', sa.Text(), nullable=True, comment='부가 설명'),

            # 기간
            sa.Column('start_date', sa.Date(), nullable=True, comment='시작일 (학력=입학, 경력=입사, 자격=발급)'),
            sa.Column('end_date', sa.Date(), nullable=True, comment='종료일 (학력=졸업, 경력=퇴사, 자격=만료)'),
            sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='재학·재직 중 여부 (자격증은 항상 false)'),

            # 종류별 메타 (JSONB)
            sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='kind별 추가 필드 (degree, position, certificate_number 등)'),

            # 증빙 파일
            sa.Column('attachment_url', sa.String(length=500), nullable=True),
            sa.Column('attachment_filename', sa.String(length=255), nullable=True),
            sa.Column('attachment_content_type', sa.String(length=100), nullable=True),
            sa.Column('attachment_size', sa.Integer(), nullable=True),

            # 검증 상태 (플랫폼 어드민)
            sa.Column('verification_status', sa.String(length=20), nullable=False, server_default=sa.text("'unverified'"), comment='unverified | pending | verified | rejected'),
            sa.Column('verification_requested_at', sa.DateTime(), nullable=True),
            sa.Column('verification_reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('verification_reviewed_by', sa.String(length=36), nullable=True, comment='처리한 플랫폼 어드민 account_id'),
            sa.Column('verification_reject_reason', sa.Text(), nullable=True),

            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists('ix_person_credentials_person_id'):
        op.create_index(
            'ix_person_credentials_person_id',
            'person_credentials',
            ['person_id'],
        )
    if not _index_exists('ix_person_credentials_kind'):
        op.create_index(
            'ix_person_credentials_kind',
            'person_credentials',
            ['kind'],
        )
    if not _index_exists('ix_person_credentials_verification_status'):
        op.create_index(
            'ix_person_credentials_verification_status',
            'person_credentials',
            ['verification_status'],
        )


def downgrade() -> None:
    """Drop person_credentials table."""
    op.drop_index('ix_person_credentials_verification_status', table_name='person_credentials')
    op.drop_index('ix_person_credentials_kind', table_name='person_credentials')
    op.drop_index('ix_person_credentials_person_id', table_name='person_credentials')
    op.drop_table('person_credentials')
