"""HTP 검사 테이블 추가 (htp_drawings, htp_objects, htp_interpretations)

Revision ID: 2d67c3832d3e
Revises: 10bf20ad3e8f
Create Date: 2026-04-27 19:22:42.097369

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2d67c3832d3e'
down_revision: Union[str, None] = '10bf20ad3e8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('htp_drawings',
        sa.Column('examination_id', sa.String(36), nullable=False, comment='검사 ID'),
        sa.Column('category', sa.String(20), nullable=False, comment='그림 유형: house|tree|man|woman'),
        sa.Column('image_url', sa.String(500), nullable=True, comment='표시 이미지 경로'),
        sa.Column('original_image_url', sa.String(500), nullable=True, comment='원본 이미지 경로'),
        sa.Column('image_width', sa.Integer(), nullable=True, comment='원본 이미지 너비 (px)'),
        sa.Column('image_height', sa.Integer(), nullable=True, comment='원본 이미지 높이 (px)'),
        sa.Column('pdi_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='PDI 데이터'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0', comment='정렬 순서'),
        sa.Column('id', sa.String(36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_htp_drawings_examination_id'), 'htp_drawings', ['examination_id'])

    op.create_table('htp_objects',
        sa.Column('drawing_id', sa.String(36), nullable=False, comment='그림 ID'),
        sa.Column('examination_id', sa.String(36), nullable=False, comment='검사 ID (비정규화)'),
        sa.Column('label', sa.String(50), nullable=False, comment='객체 레이블'),
        sa.Column('bbox_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='바운딩 박스'),
        sa.Column('confidence', sa.Float(), nullable=True, comment='탐지 신뢰도'),
        sa.Column('main_cond', sa.String(50), nullable=True, comment='주 분석 조건'),
        sa.Column('sub_cond', sa.String(50), nullable=True, comment='세부 분석 값'),
        sa.Column('is_manual', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='수동 추가 여부'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0', comment='정렬 순서'),
        sa.Column('id', sa.String(36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_htp_objects_drawing_id'), 'htp_objects', ['drawing_id'])
    op.create_index(op.f('ix_htp_objects_examination_id'), 'htp_objects', ['examination_id'])

    op.create_table('htp_interpretations',
        sa.Column('examination_id', sa.String(36), nullable=False, comment='검사 ID'),
        sa.Column('drawing_id', sa.String(36), nullable=True, comment='그림 ID'),
        sa.Column('object_id', sa.String(36), nullable=True, comment='연결된 객체 ID'),
        sa.Column('main_category', sa.String(30), nullable=False, comment='주 카테고리'),
        sa.Column('sub_category', sa.String(50), nullable=False, comment='하위 카테고리'),
        sa.Column('sentence', sa.Text(), nullable=False, comment='해석 문장'),
        sa.Column('target_name', sa.String(50), nullable=True, comment='복합 해석 대상 객체명'),
        sa.Column('is_important', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='중요 소견 여부'),
        sa.Column('is_safety', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='안전/안정 지표 여부'),
        sa.Column('is_compound', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment='복합 해석 여부'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0', comment='정렬 순서'),
        sa.Column('id', sa.String(36), nullable=False, comment='UUID Primary Key'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_htp_interpretations_examination_id'), 'htp_interpretations', ['examination_id'])
    op.create_index(op.f('ix_htp_interpretations_drawing_id'), 'htp_interpretations', ['drawing_id'])


def downgrade() -> None:
    op.drop_table('htp_interpretations')
    op.drop_table('htp_objects')
    op.drop_table('htp_drawings')
