"""add_lab_prompt_versions_and_experiment_runs

Revision ID: b4ce9cb63840
Revises: c89a87164ba0
Create Date: 2026-04-01 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

# revision identifiers, used by Alembic.
revision: str = 'b4ce9cb63840'
down_revision: Union[str, Sequence[str], None] = 'c89a87164ba0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table: str) -> bool:
    """테이블이 이미 존재하는지 확인."""
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    return table in inspector.get_table_names()


def _has_index(table: str, index_name: str) -> bool:
    """테이블에 인덱스가 이미 존재하는지 확인."""
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    indexes = [idx['name'] for idx in inspector.get_indexes(table)]
    return index_name in indexes


def upgrade() -> None:
    """Lab 모듈 테이블 생성."""
    # lab_prompt_versions
    if not _has_table('lab_prompt_versions'):
        op.create_table(
            'lab_prompt_versions',
            sa.Column('id', sa.String(36), primary_key=True, comment='UUID Primary Key'),
            sa.Column('prompt_key', sa.String(50), nullable=False, comment='프롬프트 키 (refine, summary, counseling_note, recommendation)'),
            sa.Column('version', sa.Integer(), nullable=False, comment='버전 번호'),
            sa.Column('name', sa.String(200), nullable=False, comment='사용자 지정 이름'),
            sa.Column('system_prompt', sa.Text(), nullable=False, comment='시스템 프롬프트'),
            sa.Column('user_prompt_template', sa.Text(), nullable=True, comment='사용자 프롬프트 템플릿'),
            sa.Column('author_id', sa.String(36), nullable=True, comment='작성자 ID'),
            sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
            sa.Column('is_production', sa.Boolean(), nullable=False, default=False, comment='프로덕션 프롬프트 여부'),
            sa.Column('description', sa.Text(), nullable=True, comment='변경 설명'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        )
    if not _has_index('lab_prompt_versions', 'ix_lab_prompt_versions_prompt_key'):
        op.create_index('ix_lab_prompt_versions_prompt_key', 'lab_prompt_versions', ['prompt_key'])
    if not _has_index('lab_prompt_versions', 'ix_lab_prompt_versions_key_version'):
        op.create_index('ix_lab_prompt_versions_key_version', 'lab_prompt_versions', ['prompt_key', 'version'], unique=True)

    # lab_experiment_runs
    if not _has_table('lab_experiment_runs'):
        op.create_table(
            'lab_experiment_runs',
            sa.Column('id', sa.String(36), primary_key=True, comment='UUID Primary Key'),
            sa.Column('experiment_type', sa.String(30), nullable=False, comment='실험 유형'),
            sa.Column('field_note_id', sa.String(36), nullable=True, comment='원본 필드노트 ID'),
            sa.Column('field_note_audio_id', sa.String(36), nullable=True, comment='원본 오디오 ID'),
            sa.Column('provider', sa.String(30), nullable=False, server_default='openai', comment='제공사'),
            sa.Column('model_name', sa.String(80), nullable=False, comment='모델명'),
            sa.Column('model_params', sa.Text(), nullable=True, comment='모델 파라미터 (JSON)'),
            sa.Column('prompt_version_id', sa.String(36), nullable=True, comment='사용된 프롬프트 버전 ID'),
            sa.Column('author_id', sa.String(36), nullable=True, comment='실행자 ID'),
            sa.Column('status', sa.String(20), nullable=False, server_default='pending', comment='상태'),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('latency_ms', sa.Integer(), nullable=True, comment='실행 시간 (ms)'),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('input_text', sa.Text(), nullable=True, comment='입력 텍스트'),
            sa.Column('input_audio_duration', sa.Float(), nullable=True, comment='오디오 길이 (초)'),
            sa.Column('input_tokens', sa.Integer(), nullable=True),
            sa.Column('output_tokens', sa.Integer(), nullable=True),
            sa.Column('total_tokens', sa.Integer(), nullable=True),
            sa.Column('estimated_cost_usd', sa.Float(), nullable=True),
            sa.Column('output_text', sa.Text(), nullable=True, comment='결과 텍스트'),
            sa.Column('output_json', sa.Text(), nullable=True, comment='결과 JSON'),
            sa.Column('tags', sa.String(500), nullable=True, comment='태그'),
            sa.Column('notes', sa.Text(), nullable=True, comment='메모'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
        )
    if not _has_index('lab_experiment_runs', 'ix_lab_experiment_runs_experiment_type'):
        op.create_index('ix_lab_experiment_runs_experiment_type', 'lab_experiment_runs', ['experiment_type'])
    if not _has_index('lab_experiment_runs', 'ix_lab_experiment_runs_field_note_id'):
        op.create_index('ix_lab_experiment_runs_field_note_id', 'lab_experiment_runs', ['field_note_id'])


def downgrade() -> None:
    """Lab 모듈 테이블 삭제."""
    op.drop_index('ix_lab_experiment_runs_field_note_id', table_name='lab_experiment_runs')
    op.drop_index('ix_lab_experiment_runs_experiment_type', table_name='lab_experiment_runs')
    op.drop_table('lab_experiment_runs')

    op.drop_index('ix_lab_prompt_versions_key_version', table_name='lab_prompt_versions')
    op.drop_index('ix_lab_prompt_versions_prompt_key', table_name='lab_prompt_versions')
    op.drop_table('lab_prompt_versions')
