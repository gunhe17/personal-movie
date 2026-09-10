"""add plan_configs UI metadata columns

Revision ID: b3b4f6b364b6
Revises: 7794f9e2258b
Create Date: 2026-06-04 14:23:25.084623

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b3b4f6b364b6'
down_revision: Union[str, Sequence[str], None] = '7794f9e2258b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── 시드 데이터: 프론트엔드 하드코딩 값을 DB로 이관 ──

_PLAN_META = {
    'free': {
        'tagline': '기본 상담 관리',
        'audience': '기능 체험을 원하는 분',
        'is_recommended': False,
        'base_features': '["내담자·일정·상담 기록 관리", "심리검사 접수 및 채점", "구성원 역할 관리"]',
        'additions': '["내담자·일정·상담 기록 통합 관리", "심리검사 접수 및 자동 채점", "상담사 역할·권한 설정"]',
        'base_plan': None,
        'badge_bg': 'bg-gray-100',
        'badge_text': 'text-gray-600',
    },
    'starter': {
        'tagline': 'AI로 업무 시간 절약',
        'audience': '개인 상담사 · 소규모 센터',
        'is_recommended': False,
        'base_features': '["Free의 모든 기능", "통합 청구 관리"]',
        'additions': '["상담 녹음을 AI가 자동 요약", "상담일지 자동 생성", "바우처·수납 통합 청구"]',
        'base_plan': 'free',
        'badge_bg': 'bg-blue-50',
        'badge_text': 'text-blue-600',
    },
    'pro': {
        'tagline': '팀을 위한 올인원 AI',
        'audience': '5인 이상 상담 센터',
        'is_recommended': True,
        'base_features': '["Starter의 모든 기능"]',
        'additions': '["말로 일정·검사·내담자 관리", "내담자별 변화 추이 분석"]',
        'base_plan': 'starter',
        'badge_bg': 'bg-violet-50',
        'badge_text': 'text-violet-600',
    },
    'enterprise': {
        'tagline': '대규모 기관 맞춤',
        'audience': '다기관 운영 · 공공기관',
        'is_recommended': False,
        'base_features': '["Pro의 모든 기능"]',
        'additions': '["외부 시스템 API 연동", "전담 지원"]',
        'base_plan': 'pro',
        'badge_bg': 'bg-amber-50',
        'badge_text': 'text-amber-600',
    },
}

_FEATURE_LABELS = '{"ai_field_note": "AI 상담일지", "ai_agent": "AI 업무 도우미", "ai_case_analysis": "내담자 변화 분석", "billing": "통합 청구", "api_access": "외부 연동"}'
_FEATURE_DESCRIPTIONS = '{"ai_field_note": "상담 녹음을 AI가 듣고 상담일지를 자동으로 작성해 줍니다", "ai_agent": "말로 지시하면 일정 잡기, 검사 접수, 내담자 찾기를 대신합니다", "ai_case_analysis": "내담자의 회기별 변화를 자동으로 추적하고 요약합니다", "billing": "바우처·수납을 한 곳에서 관리합니다", "api_access": "외부 시스템과 데이터를 주고받을 수 있습니다"}'


def upgrade() -> None:
    """Upgrade schema."""
    # 1. 컬럼 추가
    op.add_column('plan_configs', sa.Column('tagline', sa.String(length=200), nullable=True, comment='플랜 한줄 설명'))
    op.add_column('plan_configs', sa.Column('audience', sa.String(length=200), nullable=True, comment='대상 고객'))
    op.add_column('plan_configs', sa.Column('is_recommended', sa.Boolean(), nullable=True, comment='추천 플랜 여부'))
    op.add_column('plan_configs', sa.Column('base_features', sa.Text(), nullable=True, comment='기본 기능 설명 (JSON array)'))
    op.add_column('plan_configs', sa.Column('additions', sa.Text(), nullable=True, comment='이전 플랜 대비 추가 혜택 (JSON array)'))
    op.add_column('plan_configs', sa.Column('base_plan', sa.String(length=30), nullable=True, comment='포함하는 하위 플랜 키'))
    op.add_column('plan_configs', sa.Column('badge_bg', sa.String(length=50), nullable=True, comment='뱃지 배경 CSS 클래스'))
    op.add_column('plan_configs', sa.Column('badge_text', sa.String(length=50), nullable=True, comment='뱃지 텍스트 CSS 클래스'))
    op.add_column('plan_configs', sa.Column('feature_labels', sa.Text(), nullable=True, comment='기능별 한글 라벨 (JSON object)'))
    op.add_column('plan_configs', sa.Column('feature_descriptions', sa.Text(), nullable=True, comment='기능별 설명 (JSON object)'))

    # 2. 기존 행에 시드 데이터 업데이트
    for plan_type, meta in _PLAN_META.items():
        op.execute(
            sa.text(
                "UPDATE plan_configs SET "
                "tagline = :tagline, audience = :audience, is_recommended = :is_recommended, "
                "base_features = :base_features, additions = :additions, base_plan = :base_plan, "
                "badge_bg = :badge_bg, badge_text = :badge_text, "
                "feature_labels = :feature_labels, feature_descriptions = :feature_descriptions "
                "WHERE plan_type = :plan_type"
            ).bindparams(
                plan_type=plan_type,
                tagline=meta['tagline'],
                audience=meta['audience'],
                is_recommended=meta['is_recommended'],
                base_features=meta['base_features'],
                additions=meta['additions'],
                base_plan=meta['base_plan'],
                badge_bg=meta['badge_bg'],
                badge_text=meta['badge_text'],
                feature_labels=_FEATURE_LABELS,
                feature_descriptions=_FEATURE_DESCRIPTIONS,
            )
        )

    # 3. is_recommended NOT NULL 제약 추가
    op.alter_column('plan_configs', 'is_recommended', nullable=False, server_default=sa.text('false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('plan_configs', 'feature_descriptions')
    op.drop_column('plan_configs', 'feature_labels')
    op.drop_column('plan_configs', 'badge_text')
    op.drop_column('plan_configs', 'badge_bg')
    op.drop_column('plan_configs', 'base_plan')
    op.drop_column('plan_configs', 'additions')
    op.drop_column('plan_configs', 'base_features')
    op.drop_column('plan_configs', 'is_recommended')
    op.drop_column('plan_configs', 'audience')
    op.drop_column('plan_configs', 'tagline')
