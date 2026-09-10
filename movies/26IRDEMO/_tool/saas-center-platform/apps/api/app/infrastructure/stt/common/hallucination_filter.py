"""STT hallucination 필터

OpenAI Whisper 계열은 무음/노이즈 구간을 영어 단어로 환각하는 알려진 문제가 있다.
대표 패턴:
- 동일 단어 다회 반복 ("up up up..." 40회)
- YouTube 학습 데이터에서 온 영어 정형구 ("thanks for watching", "please subscribe")
- subtitle 출처 표기 ("subtitles by Amara.org")
- 무음 구간에서 STT prompt 파라미터 자체를 그대로 전사 결과로 반복 (prompt leakage)

이 필터는 보수적으로 동작 — 정상 영어 단어/혼합 문장은 보존한다.
"""
from __future__ import annotations

import re

from app.core.logger import get_logger
from app.infrastructure.stt.whisper.prompts import (
    KO_DOMAIN_PROMPT_FULL,
    KO_DOMAIN_PROMPT_LITE,
)

logger = get_logger(__name__)

# 알려진 hallucination 정형구 (소문자 비교). 정상 발화에서 나올 일이 없는 문구들.
_KNOWN_HALLUCINATIONS: tuple[str, ...] = (
    "thanks for watching",
    "thank you for watching",
    "please subscribe",
    "like and subscribe",
    "see you next time",
    "see you in the next video",
    "subtitles by",
    "amara.org",
    "subscribe to my channel",
    "shabbat shalom",
    "이 시청을 시청해 주셔서 감사합니다",  # 가끔 한국어 번역으로도 나옴
    "시청해주셔서 감사합니다",
)

# 영어 + 공백/구두점만 포함하는지
_ASCII_ONLY_RE = re.compile(r"^[\sA-Za-z0-9.,!?'\"\-]+$")
# 한글 포함 여부
_HANGUL_RE = re.compile(r"[가-힣]")

# prompt-leakage 비교용 — em-dash/en-dash/minus/hyphen 을 모두 공백으로 통일.
# dash 주변 공백 유무 차이("심리상담—내담자" vs "심리상담 - 내담자")까지 흡수.
_DASH_NORMALIZE_RE = re.compile(r"[—–−\-]")
# 다중 공백 → 단일 공백.
_WHITESPACE_NORMALIZE_RE = re.compile(r"\s+")
# prompt 를 문장 단위로 분리 (마침표/한국어 마침표 + 공백 기준).
_SENTENCE_SPLIT_RE = re.compile(r"[.。]\s+")


def _normalize_for_prompt_match(text: str) -> str:
    """prompt-leakage 비교용 정규화. dash 를 공백으로 변환 + 공백 정규화 + 소문자."""
    text = _DASH_NORMALIZE_RE.sub(" ", text)
    text = _WHITESPACE_NORMALIZE_RE.sub(" ", text).strip()
    return text.lower()


def _split_prompt_sentences(prompt: str) -> list[str]:
    """prompt 를 문장 단위로 분리. FULL prompt 일부만 환각으로 나오는 케이스 대응."""
    return [s.strip() for s in _SENTENCE_SPLIT_RE.split(prompt) if s.strip()]


# 모듈 로드 시 prompt 상수 + 문장 분할본을 모두 normalize — 비교 때마다 다시 계산하지 않게.
# LITE/FULL 전체 + FULL 의 각 문장이 비교 대상에 포함됨.
def _build_normalized_prompts() -> tuple[str, ...]:
    raw_prompts: list[str] = []
    for prompt in (KO_DOMAIN_PROMPT_LITE, KO_DOMAIN_PROMPT_FULL):
        raw_prompts.append(prompt)
        raw_prompts.extend(_split_prompt_sentences(prompt))
    # 중복 제거하면서 순서 보존
    seen: set[str] = set()
    unique: list[str] = []
    for p in raw_prompts:
        norm = _normalize_for_prompt_match(p)
        if norm and norm not in seen:
            seen.add(norm)
            unique.append(norm)
    return tuple(unique)


_NORMALIZED_PROMPTS: tuple[str, ...] = _build_normalized_prompts()

# 짧은 정상 발화가 prompt 일부와 우연히 매치되는 걸 막기 위한 하한.
_PROMPT_LEAKAGE_MIN_LENGTH = 8
# 전사가 prompt 의 substring 일 때, prompt 대비 차지 비율 임계값.
# (0.5 = prompt 의 절반 이상을 차지해야 leakage 로 판정)
_PROMPT_LEAKAGE_MIN_RATIO = 0.5


def _is_ascii_only(text: str) -> bool:
    """텍스트가 영문/공백/구두점만으로 구성되었는지 (한글 없음)."""
    return bool(text.strip()) and bool(_ASCII_ONLY_RE.match(text))


def _has_excessive_repetition(text: str, min_repeats: int = 5) -> bool:
    """동일 단어(또는 짧은 토큰)가 min_repeats 회 이상 반복되는지.

    "up up up up up..." (40회) 같은 환각 패턴 검출.
    """
    tokens = text.lower().split()
    if len(tokens) < min_repeats:
        return False
    # 가장 빈번한 토큰의 출현 횟수
    counts: dict[str, int] = {}
    for t in tokens:
        counts[t] = counts.get(t, 0) + 1
    max_count = max(counts.values())
    # 전체의 절반 이상을 한 단어가 차지하면 반복으로 간주
    return max_count >= min_repeats and max_count / len(tokens) >= 0.5


def _is_prompt_leakage(text: str) -> bool:
    """전사 결과가 STT prompt 자체를 그대로(또는 거의 그대로) 반복하는지.

    Whisper 계열은 무음/저신호 구간에서 prompt 파라미터를 전사 결과로 반환하는
    경향이 있다 (예: "한국어 심리상담 — 내담자, 상담사, 회기, 감정").

    검출 규칙 (보수적):
    - prompt 전체가 전사에 포함 → 통째 leakage
    - 전사가 prompt 의 substring 이고, prompt 대비 비율 ≥ _PROMPT_LEAKAGE_MIN_RATIO → 부분 leakage
    - 둘 다 최소 길이 _PROMPT_LEAKAGE_MIN_LENGTH 이상일 때만 검사 (짧은 정상 발화 보존)
    """
    norm = _normalize_for_prompt_match(text)
    if len(norm) < _PROMPT_LEAKAGE_MIN_LENGTH:
        return False

    for prompt in _NORMALIZED_PROMPTS:
        # 1) prompt 가 전사에 통째로 들어가 있음 (전사가 prompt 보다 길거나 같음)
        if prompt in norm:
            return True
        # 2) 전사가 prompt 의 일부 — prompt 의 절반 이상을 차지해야 leakage 로 판정
        if norm in prompt:
            ratio = len(norm) / len(prompt)
            if ratio >= _PROMPT_LEAKAGE_MIN_RATIO:
                return True

    return False


def is_hallucination(text: str) -> bool:
    """주어진 segment text 가 hallucination 으로 의심되는지."""
    stripped = text.strip()
    if not stripped:
        return False

    lower = stripped.lower()

    # 1) 알려진 정형구
    for phrase in _KNOWN_HALLUCINATIONS:
        if phrase in lower:
            return True

    # 2) 영어만 + 과도한 반복
    if _is_ascii_only(stripped) and _has_excessive_repetition(stripped):
        return True

    # 3) STT prompt 자체를 반복한 leakage
    if _is_prompt_leakage(stripped):
        return True

    return False


def filter_hallucinated_segments(segments: list[dict]) -> tuple[list[dict], int]:
    filtered: list[dict] = []
    removed = 0
    for seg in segments:
        text = seg.get("text", "") if isinstance(seg, dict) else ""
        if is_hallucination(text):
            removed += 1
            logger.info(
                f"Hallucination filtered: speaker={seg.get('speaker')}, "
                f"start={seg.get('start')}, text={text[:80]!r}"
            )
            continue
        filtered.append(seg)
    return filtered, removed
