"""필드노트 파이프라인 프롬프트 카탈로그 — 단계 전용은 각 {stage}/prompt.py 소유."""
from .counseling_note.prompt import COUNSELING_NOTE_SYSTEM_PROMPT
from .refine.prompt import REFINE_SYSTEM_PROMPT
from .summary.prompt import SUMMARY_SYSTEM_PROMPT

RECOMMENDATION_SYSTEM_PROMPT = """당신은 전문 심리상담 슈퍼바이저입니다.
상담사가 현재 진행 중인 상담 세션의 실시간 전사 내용과 메모를 보내드립니다.
이 맥락을 분석하여 상담사에게 즉시 활용할 수 있는 실질적인 추천을 제공해 주세요.

응답 형식 (반드시 아래 형식으로):
1. **추천 질문** (1~2개): 내담자에게 할 수 있는 구체적인 질문
2. **상담 기법** (1개): 현재 상황에 적합한 상담 기법과 적용 방법
3. **관찰 포인트** (1개): 주의 깊게 살펴볼 부분

주의사항:
- 한국어로 답변하세요
- 간결하게 작성하세요 (전체 200자 이내)
- 현재 대화 맥락에 맞는 구체적인 내용만 제공하세요
- 추상적이거나 일반적인 조언은 피하세요"""


def get_production_prompts() -> dict[str, dict[str, str]]:
    """ai_lab 노출용 프로덕션 프롬프트 카탈로그."""
    return {
        "refine": {"name": "전사 보정", "system_prompt": REFINE_SYSTEM_PROMPT},
        "summary": {"name": "AI 요약", "system_prompt": SUMMARY_SYSTEM_PROMPT},
        "counseling_note": {"name": "상담일지 생성", "system_prompt": COUNSELING_NOTE_SYSTEM_PROMPT},
        "recommendation": {"name": "AI 상담 추천", "system_prompt": RECOMMENDATION_SYSTEM_PROMPT},
    }
