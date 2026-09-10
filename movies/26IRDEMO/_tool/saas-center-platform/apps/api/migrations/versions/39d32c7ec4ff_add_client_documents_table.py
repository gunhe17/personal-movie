"""add client_documents table

Revision ID: 39d32c7ec4ff
Revises: 30e922483335
Create Date: 2026-02-19 15:56:08.570187

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39d32c7ec4ff'
down_revision: Union[str, Sequence[str], None] = '30e922483335'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'client_documents',
        sa.Column('center_id', sa.String(36), nullable=False, comment='센터 ID (RLS)'),
        sa.Column('client_id', sa.String(36), nullable=False, comment='내담자 ID'),
        sa.Column('document_id', sa.String(36), nullable=False, comment='문서 ID'),
        sa.Column('resource_type', sa.String(20), nullable=False, comment='리소스 유형 (pre_admission, consent, assessment, other)'),
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', 'document_id', name='uq_client_document'),
    )
    op.create_index('ix_client_documents_client', 'client_documents', ['client_id'])
    op.create_index('ix_client_documents_center', 'client_documents', ['center_id'])
    op.create_index('ix_client_documents_type', 'client_documents', ['client_id', 'resource_type'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_client_documents_type', table_name='client_documents')
    op.drop_index('ix_client_documents_center', table_name='client_documents')
    op.drop_index('ix_client_documents_client', table_name='client_documents')
    op.drop_table('client_documents')
