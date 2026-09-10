"""최종 응답 새니타이저 — dev 어휘(UUID·경로·내부 코드)를 서비스 언어로 강제.

프롬프트 지시("UUID 노출 금지")는 모델이 무시함 실측(2026-07-27 상담실 ID 노출, 구 laguna) —
표현 계층은 출력단이 정본(B12 목록 렌더러 흡수와 같은 결). 스트림 델타는 원문이나
WUI가 최종 completion으로 버블을 교체하므로 사용자 최종 화면·DB는 이 결과만 남는다.
"""

import re

# API 내부 이름 → WUI 표현. 내부 어휘가 답변에 새는 사례가 관측되면 여기 등재
SERVICE_TERMS = {
    "COUNSELOR": "상담사",
    "MANAGER": "관리자",
    "STAFF": "직원",
    "FULLTIME": "정규직",
    "CONTRACT": "계약직",
    "FREELANCER": "프리랜서",
    "INDIVIDUAL": "개인",
    "GROUP": "그룹",
    "MALE": "남",
    "FEMALE": "여",
    "assessment_set": "검사 세트",
}

_UUID = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
# UUID는 토큰 제거가 아니라 문장 제거 — "ID는 `…`입니다" 꼬리가 남지 않게
_UUID_SENTENCE = re.compile(rf"[^.!?\n]*`?{_UUID}`?[^.!?\n]*[.!?]?\s*")
_PATH_TOKEN = re.compile(r"`?/[A-Za-z0-9_\-/?&=%.]{2,}`?")
_EMPTY_PAREN = re.compile(r"\(\s*(화면\s*경로|경로)?\s*[:：]?\s*\)")
_PATH_LABEL_LINE = re.compile(r"^\s*(화면\s*경로|경로)\s*[:：]?\s*$", re.MULTILINE)
# \b는 한글이 \w라 "FREELANCER입니다"의 경계를 못 잡는다 — ASCII 경계 lookaround로
_TERMS = [
    (re.compile(rf"(?<![A-Za-z0-9_]){re.escape(k)}(?![A-Za-z0-9_])"), v)
    for k, v in SERVICE_TERMS.items()
]


def sanitize_reply(text: str) -> str:
    if not text:
        return text
    out = _UUID_SENTENCE.sub("", text)
    out = _PATH_TOKEN.sub("", out)
    out = _EMPTY_PAREN.sub("", out)
    out = _PATH_LABEL_LINE.sub("", out)
    for pattern, term in _TERMS:
        out = pattern.sub(term, out)
    out = re.sub(r"[ \t]{2,}", " ", out)
    out = re.sub(r"[ \t]+$", "", out, flags=re.MULTILINE)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()
