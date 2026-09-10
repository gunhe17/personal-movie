"""내담자 앱 전역 평면: families·family_members·profiles + center_links·invitations·audits

Revision ID: a3c9e17b52d4
Revises: 1818f2c3637c
Create Date: 2026-07-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3c9e17b52d4'
down_revision: Union[str, Sequence[str], None] = '1818f2c3637c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _audit_columns() -> list[sa.Column]:
    return [
        sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
    ]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'families',
        sa.Column('name', sa.String(length=100), nullable=True),
        *_audit_columns(),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )

    op.create_table(
        'family_members',
        sa.Column('family_id', sa.String(length=36), nullable=False),
        sa.Column('person_id', sa.String(length=36), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        *_audit_columns(),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_family_members_family_id', 'family_members', ['family_id'], if_not_exists=True)
    op.create_index('ix_family_members_person_id', 'family_members', ['person_id'], if_not_exists=True)
    op.create_index(
        'uq_family_members_family_person_active',
        'family_members',
        ['family_id', 'person_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL'),
        if_not_exists=True,
    )

    op.create_table(
        'profiles',
        sa.Column('family_id', sa.String(length=36), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('relation', sa.String(length=20), nullable=False),
        sa.Column('birth_date', sa.Date(), nullable=True),
        sa.Column('gender', sa.String(length=10), nullable=True),
        *_audit_columns(),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_profiles_family_id', 'profiles', ['family_id'], if_not_exists=True)

    op.create_table(
        'center_links',
        sa.Column('family_id', sa.String(length=36), nullable=False),
        sa.Column('profile_id', sa.String(length=36), nullable=False),
        sa.Column('person_id', sa.String(length=36), nullable=False),
        sa.Column('center_id', sa.String(length=36), nullable=False),
        sa.Column('client_id', sa.String(length=36), nullable=False),
        sa.Column('guardian_client_id', sa.String(length=36), nullable=False),
        sa.Column('invitation_id', sa.String(length=36), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('linked_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('end_reason', sa.String(length=50), nullable=True),
        *_audit_columns(),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    for col in ('family_id', 'profile_id', 'person_id', 'center_id', 'client_id'):
        op.create_index(f'ix_center_links_{col}', 'center_links', [col], if_not_exists=True)
    op.create_index(
        'uq_center_links_profile_center_alive',
        'center_links',
        ['profile_id', 'center_id'],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND status IN ('requested', 'active', 'suspended')"),
        if_not_exists=True,
    )
    op.create_index(
        'uq_center_links_family_client_alive',
        'center_links',
        ['family_id', 'client_id'],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL AND status IN ('requested', 'active', 'suspended')"),
        if_not_exists=True,
    )

    op.create_table(
        'center_link_invitations',
        sa.Column('center_id', sa.String(length=36), nullable=False),
        sa.Column('guardian_client_id', sa.String(length=36), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('issued_by_member_id', sa.String(length=36), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('claimed_at', sa.DateTime(), nullable=True),
        sa.Column('claimed_by_person_id', sa.String(length=36), nullable=True),
        *_audit_columns(),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_center_link_invitations_center_id', 'center_link_invitations', ['center_id'], if_not_exists=True)
    op.create_index('ix_center_link_invitations_guardian_client_id', 'center_link_invitations', ['guardian_client_id'], if_not_exists=True)
    op.create_index('ix_center_link_invitations_code', 'center_link_invitations', ['code'], if_not_exists=True)

    op.create_table(
        'center_link_audits',
        sa.Column('center_id', sa.String(length=36), nullable=False),
        sa.Column('link_id', sa.String(length=36), nullable=True),
        sa.Column('invitation_id', sa.String(length=36), nullable=True),
        sa.Column('actor_type', sa.String(length=20), nullable=False),
        sa.Column('actor_id', sa.String(length=36), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        *_audit_columns(),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_center_link_audits_center_id', 'center_link_audits', ['center_id'], if_not_exists=True)
    op.create_index('ix_center_link_audits_link_id', 'center_link_audits', ['link_id'], if_not_exists=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('center_link_audits')
    op.drop_table('center_link_invitations')
    op.drop_table('center_links')
    op.drop_table('profiles')
    op.drop_table('family_members')
    op.drop_table('families')
