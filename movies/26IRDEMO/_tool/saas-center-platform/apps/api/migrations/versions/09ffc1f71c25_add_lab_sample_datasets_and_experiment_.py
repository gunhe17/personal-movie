"""add lab sample datasets and experiment groups tables

Revision ID: 09ffc1f71c25
Revises: b114dacb4163
Create Date: 2026-04-06 18:39:09.252913

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '09ffc1f71c25'
down_revision: Union[str, Sequence[str], None] = 'b114dacb4163'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy.engine.reflection import Inspector
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing_tables = set(inspector.get_table_names())

    # LabSampleDataset 테이블 생성
    if 'lab_sample_datasets' not in existing_tables:
        op.create_table(
            'lab_sample_datasets',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('name', sa.String(length=200), nullable=False, comment='샘플 이름 (예: \'10분 단회 상담 샘플\')'),
            sa.Column('description', sa.Text(), nullable=True, comment='샘플 설명'),
            sa.Column('input_type', sa.String(length=20), nullable=False, comment='입력 유형 (text, audio)'),
            sa.Column('text_content', sa.Text(), nullable=True, comment='텍스트 샘플 내용 (최대 50,000자)'),
            sa.Column('s3_key', sa.String(length=500), nullable=True, comment='S3 저장 경로 (centers/lab/samples/{uuid}.webm)'),
            sa.Column('audio_duration', sa.Float(), nullable=True, comment='오디오 길이 (초)'),
            sa.Column('audio_file_size', sa.Integer(), nullable=True, comment='오디오 파일 크기 (bytes)'),
            sa.Column('tags', sa.String(length=500), nullable=True, comment='태그 (쉼표 구분, 예: \'baseline,short,single-session\')'),
            sa.Column('source_type', sa.String(length=30), nullable=True, comment='출처 (manual, field_note, synthetic)'),
            sa.Column('field_note_id', sa.String(length=36), nullable=True, comment='원본 필드노트 ID (참조용, 제약 없음)'),
            sa.Column('author_id', sa.String(length=36), nullable=True, comment='등록자 ID'),
            sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0', comment='실험 사용 횟수'),
            sa.Column('last_used_at', sa.DateTime(timezone=False), nullable=True, comment='마지막 사용 시각 (UTC)'),
            sa.Column('created_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(timezone=False), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )
        existing_tables.add('lab_sample_datasets')

    _ensure_indexes(inspector, 'lab_sample_datasets', {
        'ix_lab_sample_datasets_input_type': ['input_type'],
        'ix_lab_sample_datasets_field_note_id': ['field_note_id'],
    })

    # LabExperimentGroup 테이블 생성
    if 'lab_experiment_groups' not in existing_tables:
        op.create_table(
            'lab_experiment_groups',
            sa.Column('id', sa.String(length=36), nullable=False, comment='UUID Primary Key'),
            sa.Column('name', sa.String(length=200), nullable=False, comment='그룹 이름 (예: \'GPT-4o vs Claude 비교\')'),
            sa.Column('description', sa.Text(), nullable=True, comment='실험 목적 및 설명'),
            sa.Column('experiment_type', sa.String(length=30), nullable=False, comment='실험 유형 (llm_refine, llm_summary, stt_diarize)'),
            sa.Column('sample_id', sa.String(length=36), nullable=False, comment='사용된 샘플 데이터셋 ID'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending', comment='상태 (pending, running, completed, partial_failed, failed)'),
            sa.Column('total_runs', sa.Integer(), nullable=False, server_default='0', comment='총 실행 수 (변형 개수)'),
            sa.Column('completed_runs', sa.Integer(), nullable=False, server_default='0', comment='완료된 실행 수'),
            sa.Column('failed_runs', sa.Integer(), nullable=False, server_default='0', comment='실패한 실행 수'),
            sa.Column('started_at', sa.DateTime(timezone=False), nullable=True),
            sa.Column('completed_at', sa.DateTime(timezone=False), nullable=True),
            sa.Column('best_run_id', sa.String(length=36), nullable=True, comment='최고 품질 실행 ID (quality_score 기준)'),
            sa.Column('cheapest_run_id', sa.String(length=36), nullable=True, comment='최저 비용 실행 ID'),
            sa.Column('fastest_run_id', sa.String(length=36), nullable=True, comment='최저 지연시간 실행 ID'),
            sa.Column('total_cost_usd', sa.Float(), nullable=True, comment='그룹 총 비용 (USD)'),
            sa.Column('avg_latency_ms', sa.Integer(), nullable=True, comment='평균 지연시간 (ms)'),
            sa.Column('author_id', sa.String(length=36), nullable=True, comment='실행자 ID'),
            sa.Column('tags', sa.String(length=500), nullable=True, comment='태그'),
            sa.Column('notes', sa.Text(), nullable=True, comment='메모'),
            sa.Column('created_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False, comment='생성 시각 (UTC)'),
            sa.Column('updated_at', sa.DateTime(timezone=False), server_default=sa.text('now()'), nullable=False, comment='수정 시각 (UTC)'),
            sa.Column('deleted_at', sa.DateTime(timezone=False), nullable=True, comment='삭제 시각 (UTC, Soft Delete)'),
            sa.PrimaryKeyConstraint('id'),
        )

    _ensure_indexes(inspector, 'lab_experiment_groups', {
        'ix_lab_experiment_groups_type': ['experiment_type'],
        'ix_lab_experiment_groups_sample_id': ['sample_id'],
        'ix_lab_experiment_groups_status': ['status'],
    })

    # LabExperimentRun 컬럼 추가
    existing_run_cols = {col['name'] for col in inspector.get_columns('lab_experiment_runs')}
    if 'sample_id' not in existing_run_cols:
        op.add_column('lab_experiment_runs', sa.Column('sample_id', sa.String(length=36), nullable=True, comment='샘플 데이터셋 ID (독립 실험용)'))
    if 'group_id' not in existing_run_cols:
        op.add_column('lab_experiment_runs', sa.Column('group_id', sa.String(length=36), nullable=True, comment='실험 그룹 ID (배치 비교용)'))

    _ensure_indexes(inspector, 'lab_experiment_runs', {
        'ix_lab_experiment_runs_sample_id': ['sample_id'],
        'ix_lab_experiment_runs_group_id': ['group_id'],
    })


def _ensure_indexes(inspector, table: str, indexes: dict) -> None:
    existing = {idx['name'] for idx in inspector.get_indexes(table)}
    for name, cols in indexes.items():
        if name not in existing:
            op.create_index(name, table, cols)


def downgrade() -> None:
    """Downgrade schema."""
    # LabExperimentRun 인덱스 삭제
    op.drop_index('ix_lab_experiment_runs_group_id', table_name='lab_experiment_runs')
    op.drop_index('ix_lab_experiment_runs_sample_id', table_name='lab_experiment_runs')

    # LabExperimentRun 컬럼 삭제
    op.drop_column('lab_experiment_runs', 'group_id')
    op.drop_column('lab_experiment_runs', 'sample_id')

    # LabExperimentGroup 테이블 삭제
    op.drop_index('ix_lab_experiment_groups_status', table_name='lab_experiment_groups')
    op.drop_index('ix_lab_experiment_groups_sample_id', table_name='lab_experiment_groups')
    op.drop_index('ix_lab_experiment_groups_type', table_name='lab_experiment_groups')
    op.drop_table('lab_experiment_groups')

    # LabSampleDataset 테이블 삭제
    op.drop_index('ix_lab_sample_datasets_field_note_id', table_name='lab_sample_datasets')
    op.drop_index('ix_lab_sample_datasets_input_type', table_name='lab_sample_datasets')
    op.drop_table('lab_sample_datasets')
