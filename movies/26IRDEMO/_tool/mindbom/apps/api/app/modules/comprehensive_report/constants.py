"""종합보고서 상수 — 섹션 정의, 라벨 (프론트 constants.ts와 미러링)"""
from app.modules.examination.common.state_machine import CONFIRMED_STATUSES

# 검사 유형 라벨
EXAM_TYPE_LABELS: dict[str, str] = {
    "htp": "HTP (집-나무-사람)",
    "rorschach": "로르샤하",
    "sct": "SCT (문장완성검사)",
}

# 종합보고서에 포함 가능한 **검사(examination)** 상태 — 임상가 확정 이후.
# 종합보고서 자신의 상태가 아니라 재료가 되는 검사의 상태이므로
# examination 쪽 정본을 참조한다.
SELECTABLE_STATUSES: frozenset[str] = CONFIRMED_STATUSES

# 섹션 source 종류
#   auto      — 시스템 자동 생성 (인적사항/실시검사/검사별 결과). 편집 가능하나 재생성 대상.
#   clinician — 임상가 소유. AI가 절대 변경하지 않음.
#   ai        — AI 생성. replace_ai_sections 모드에서 교체 대상.
SOURCE_AUTO = "auto"
SOURCE_CLINICIAN = "clinician"
SOURCE_AI = "ai"

# 고정 섹션 정의 (검사별 test_results는 seed 시 per-exam 확장)
# order: 표시 순서. test_results 블록은 40~79 사이에 삽입.
SECTION_HEADER = "header"
SECTION_REFERRAL = "referral_reason"
SECTION_ATTITUDE = "assessment_attitude"
SECTION_ADMINISTERED = "administered_tests"
SECTION_TEST_RESULTS_PREFIX = "test_results__"  # + exam_id
SECTION_OPINION = "comprehensive_opinion"
SECTION_RECOMMENDATIONS = "recommendations"

# 고정 단일 섹션 템플릿 (검사별 test_results 제외)
FIXED_SECTION_DEFS: list[dict] = [
    {"key": SECTION_HEADER, "title": "인적사항", "source": SOURCE_AUTO, "order": 10},
    {"key": SECTION_REFERRAL, "title": "평가 사유", "source": SOURCE_CLINICIAN, "order": 20},
    {"key": SECTION_ATTITUDE, "title": "평가 태도 및 행동관찰", "source": SOURCE_CLINICIAN, "order": 30},
    {"key": SECTION_ADMINISTERED, "title": "실시 검사", "source": SOURCE_AUTO, "order": 40},
    # test_results (검사별) → order 50~
    {"key": SECTION_OPINION, "title": "종합 소견", "source": SOURCE_AI, "order": 80},
    {"key": SECTION_RECOMMENDATIONS, "title": "제언", "source": SOURCE_AI, "order": 90},
]

TEST_RESULTS_BASE_ORDER = 50

DEFAULT_TITLE = "종합 심리평가 보고서"
