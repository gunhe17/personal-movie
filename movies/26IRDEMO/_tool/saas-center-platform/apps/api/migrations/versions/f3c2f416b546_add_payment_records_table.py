"""add payment_records table

Revision ID: f3c2f416b546
Revises: 848df83bf8b9
Create Date: 2026-03-18 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3c2f416b546'
down_revision: Union[str, Sequence[str], None] = 'a3e84928a775'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """테이블 존재 여부 확인 (이미 수동 생성된 경우 대응)"""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :t)"
        ),
        {"t": table_name},
    )
    return result.scalar()


def _index_exists(index_name: str) -> bool:
    """인덱스 존재 여부 확인"""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pg_indexes "
            "WHERE indexname = :i)"
        ),
        {"i": index_name},
    )
    return result.scalar()


def upgrade() -> None:
    """Upgrade schema."""
    if not _table_exists("payment_records"):
        op.create_table(
            'payment_records',
            sa.Column('center_id', sa.String(length=36), nullable=False, comment='센터 ID'),
            sa.Column('client_id', sa.String(length=36), nullable=False, comment='내담자 ID'),
            sa.Column('client_name', sa.String(length=100), nullable=True, comment='내담자 이름 비정규화'),
            sa.Column('client_code', sa.String(length=20), nullable=True, comment='내담자 코드 비정규화 (e.g. 0123AB)'),
            sa.Column('related_type', sa.String(length=50), nullable=True, comment='참조 유형: counseling_session, assessment_session'),
            sa.Column('related_id', sa.String(length=36), nullable=True, comment='참조 세션 ID'),
            sa.Column('billing_code', sa.String(length=20), nullable=False, comment='청구 ID (화면 표시용, e.g. #112124421)'),
            sa.Column('description', sa.String(length=200), nullable=False, comment='내역'),
            sa.Column('amount', sa.Integer(), nullable=False, comment='결제 금액 (원)'),
            sa.Column('status', sa.String(length=20), nullable=False, comment='청구 상태: pending, completed'),
            sa.Column('issued_at', sa.DateTime(), nullable=False, comment='발행일시 (UTC)'),
            sa.Column('completed_at', sa.DateTime(), nullable=True, comment='청구 완료 시각 (UTC)'),
            sa.Column('completed_by', sa.String(length=36), nullable=True, comment='청구 완료자 account_id'),
            sa.Column('completed_by_name', sa.String(length=100), nullable=True, comment='청구 완료자 이름 비정규화'),
            sa.Column('created_by', sa.String(length=36), nullable=False, comment='최초 생성자 account_id'),
            sa.Column('note', sa.Text(), nullable=True, comment='메모'),
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _index_exists("idx_payment_records_center_status"):
        op.create_index(
            'idx_payment_records_center_status',
            'payment_records',
            ['center_id', 'status', 'issued_at'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )
    if not _index_exists("idx_payment_records_center_client"):
        op.create_index(
            'idx_payment_records_center_client',
            'payment_records',
            ['center_id', 'client_id'],
            postgresql_where=sa.text('deleted_at IS NULL'),
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_payment_records_center_client', table_name='payment_records')
    op.drop_index('idx_payment_records_center_status', table_name='payment_records')
    op.drop_table('payment_records')
