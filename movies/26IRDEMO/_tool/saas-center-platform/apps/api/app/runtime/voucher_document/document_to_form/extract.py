"""③ LLM 그라운딩 — SoM 번호 이미지 → 입력 요소(의미·타입·대략 box).

lab image-to-form extract.py (SYS_V2 · 대구획 focus) — 프롬프트·key 부여 유틸.
LLM unit 빌드·소비는 ground_batch(실행은 runner `run_stage`)가 소유.
box=[ymin,xmin,ymax,xmax] 이미지 정규화 0~1000 (Gemini 그라운딩 규약).
temperature=0.5 (실측: raw box 위치정확 78%→100%) · reasoning=low.

LLM = 의미(무엇이 입력·타입·option·unit) + 대략 위치. 정확한 위치는 carve 가 잡는다.
key 는 LLM 이 만들지 않고 서버가 assign_keys 로 결정론 부여한다.
"""
from __future__ import annotations

import re
from collections import defaultdict


GROUND_MAX_TOKENS = 20000
GROUND_REASONING = {"effort": "low"}
# 그라운딩 전용 온도 — spec.TEMPERATURE(1.0)와 별개(box 위치정확 실측 최적).
FORM_GROUND_TEMPERATURE = 0.5

TYPES = (
    "text", "textarea", "email", "phone", "number", "date", "time",
    "checkbox_group", "radio", "consent", "signature", "image",
)

# OpenRouter json_schema(strict) — key 없음(서버 부여). option/unit은 null 허용.
# Gemini 엔진(OpenRouter 경유 포함)은 additionalProperties:false 시 **선언한 전 property 를
# required 에 넣어야** 400 안 난다("requires unspecified property" — response_json_schema 제약).
# null 허용 축은 required여도 무해.
ELEMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "region": {"type": "integer", "description": "SoM 영역 번호"},
        "label": {"type": "string", "description": "한글 라벨"},
        "type": {"type": "string", "enum": list(TYPES)},
        "option": {"type": ["string", "null"], "description": "선택지 값(checkbox/radio)"},
        "unit": {"type": ["string", "null"], "description": "단위 글자(급/세/년/월 등)"},
        "box": {
            "type": "array",
            "items": {"type": "integer"},
            "minItems": 4,
            "maxItems": 4,
            "description": "[ymin,xmin,ymax,xmax] 0~1000",
        },
    },
    "required": ["region", "label", "type", "option", "unit", "box"],
    "additionalProperties": False,
}

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {"elements": {"type": "array", "items": ELEMENT_SCHEMA}},
    "required": ["elements"],
    "additionalProperties": False,
}


def ground_response_format() -> dict:
    """그라운딩 출력 강제 스키마(OpenRouter json_schema strict — batch/realtime 동일).

    region 봉쇄(블록 밖 요소 차단)는 schema enum이 아니라 focus_head 프롬프트 + 사후 clamp
    (apply_ground_results의 box1000 region 멤버십 검사)로 한다 — Google response_json_schema는
    integer+enum을 미지원(400 'requires unspecified property')이라 스키마 봉쇄가 불가.
    """
    return {
        "type": "json_schema",
        "json_schema": {"name": "form_elements", "strict": True, "schema": RESPONSE_SCHEMA},
    }


# lab image-to-form SYS_V2 verbatim — 12종 타입 + 서버 key 부여 계약.
GROUND_SYS = """# 역할
빈 정부 서식 이미지에서, 작성자가 채워 제출해야 하는 입력만 추출한다.
접수기관이 채우거나 이미 인쇄된 고정 문구는 제외한다.
이미지에는 영역 번호 박스가 표시되어 있다.

# 판단 절차
1. 문서 맥락: 어떤 정보를 모으는 서식인지 파악한다.
2. 영역 맥락: 번호 영역이 고정 인쇄인지, 사용자 입력(빈칸·선택)인지 구분한다.
3. 요소화: 입력마다 요소 1개를 만들고 type·대략 box를 정한다.
4. 실제성: 이미지에 보이는 빈칸·□·선택 표시 개수만큼만 만든다. 없는 필드는 만들지 않는다.

# 타입
허용 type은 아래 12종만. 각 타입 = 설명 + 일반화 형태. 형태에 맞으면 그 type.
(checkbox·select·datetime·file·stamp 는 쓰지 않는다. 직인·도장은 signature.)

## text
한 줄 자유 입력.
형태: 밑줄·점선·빈 셀·괄호 안 빈칸 `(___)` · `○○○` 자리표시자.

## textarea
여러 줄 자유 입력.
형태: 세로로 큰 빈 칸·여러 줄 밑줄·큰 빈 셀.

## email
이메일 주소 입력.
형태: text와 같으나 라벨/맥락이 이메일.

## phone
전화번호 입력.
형태: text와 같으나 라벨/맥락이 전화·연락처.

## number
수량·금액·나이 등 **시각이 아닌** 숫자 값.
옆에 붙은 단위 글자는 unit에만 넣고, box는 단위 앞 빈칸. 단위 글자 자체는 요소로 만들지 않는다.
형태: `___` + 단위(급·원·회·점·세·시간(총량)·m …).
경계: `시`/`분`이 시각(몇 시 몇 분)을 쓰면 time. 총 시간·연령·급수·금액만 number.

## date
날짜에서 `년`·`월`·`일` 단위 글자가 실제로 인쇄되어 있으면, 각 단위 앞 입력칸을 별도 date 요소로 만든다.
단위 글자가 없이 한 칸에 합쳐 쓰는 날짜는 date 요소 1개로 만든다. 단위 글자 자체는 요소로 만들지 않는다.
기간도 실제로 인쇄된 단위와 입력칸을 기준으로 시작·끝을 각각 분리한다.
형태: `__년 __월 __일` → 3개 · `생년월일` 단일칸 → 1개 · `__년 __월 ~ __년 __월` → 4개.

## time
시각(하루 안의 시각). 시·분이 나뉘면 칸마다 요소.
형태: `__시 __분` · `__ : __` · 시각 빈칸 + `am/pm`(시각 빈칸은 time, am/pm은 radio).
경계: 단위가 `시`여도 시각이면 time이지 number가 아니다.

## checkbox_group
네모 □가 있는 선택. □마다 요소 1개, option=그 보기 값.
□ 뒤에 손으로 쓰는 빈칸이 실제로 있으면 그 빈칸은 별도 text.
복수 선택 가능·□가 보이면 checkbox_group.
형태: `□보기` · `□보기 (___ )`.

## radio
□ 없이, **하나만** 고르는 배타적 텍스트 보기(○·동그라미·슬래시·괄호 택1 포함).
보기마다 요소 1개, option=그 보기. 빈 양식에 ○가 없어도 배타 보기면 radio.
항목 라벨 뒤 괄호 택1은 본 항목과 별도로 각 보기 radio.
형태: `A/B` · `A · B` · `(A, B)` · `am/pm` · `남/여`. 슬래시·중점으로 나열된 각 낱개가 개별 보기(`am/pm`→am·pm 2개, `오전/오후`→오전·오후 2개, `남/여`→남·여 2개). 단 `쇼크/질식`·`식사/간식시간`처럼 한 항목명 안의 슬래시는 나누지 않는다.
경계: □가 있으면 checkbox_group. □ 없이 택1이면 radio.

## consent
동의 내용 또는 동의 □.
형태: 동의 문장 + `□동의` · 동의 체크란.

## signature
서명·날인·직인 위치. 인쇄된 서명/인/직인 안내 문구 영역.
형태: `(서명 또는 인)` · `(인)` · `인)` · 서명란·직인란 문구.

## image
사진·첨부 이미지를 붙이는 칸.
형태: 사진 규격 안내가 있는 빈 부착란.

# 출력
JSON만 (Structured Output schema). key는 만들지 않는다 — 서버가 region·type·option·unit으로 부여한다.
{"elements":[{"region":정수,"label":"한글","type":"","option":""?,"unit":""?,"box":[ymin,xmin,ymax,xmax]}]}
box: 이미지 0~1000 정규화. 입력 부분(빈칸·□·문구)의 사각형. 단위·장식 괄호는 box에서 제외.
type∈[text,textarea,email,phone,number,date,time,checkbox_group,radio,consent,signature,image].
"""


def _slug(s: str) -> str:
    """key용 짧은 토큰 — 공백·특수문자 제거."""
    s = re.sub(r"\s+", "", str(s))
    s = re.sub(r"[^\w가-힣]+", "", s, flags=re.UNICODE)
    return s[:24] or "x"


def assign_keys(elements: list[dict]) -> list[dict]:
    """LLM key 폐기 → region/type/option/unit + 동일그룹 순번으로 결정론 부여.
    box 순(region, ymin, xmin)으로 정렬해 호출 간 순서 흔들림을 줄인다."""
    els = sorted(
        (dict(e) for e in elements),
        key=lambda e: (
            e.get("region") if e.get("region") is not None else 10**9,
            (e.get("box") or [0, 0, 0, 0])[0],
            (e.get("box") or [0, 0, 0, 0])[1],
            e.get("type") or "",
            str(e.get("option") or ""),
            str(e.get("unit") or ""),
        ),
    )
    counts: dict[str, int] = defaultdict(int)
    for e in els:
        e.pop("key", None)
        region = e.get("region")
        t = e.get("type") if e.get("type") in TYPES else "text"
        e["type"] = t
        base = f"r{region}_{t}"
        if e.get("option") not in (None, ""):
            base += f"_{_slug(e['option'])}"
        if e.get("unit") not in (None, ""):
            base += f"_{_slug(e['unit'])}"
        counts[base] += 1
        e["key"] = f"{base}_{counts[base]}"
    return els


def _focus_head(
    focus_ids: list[int],
    n_atoms: int,
) -> str:
    """focus_ids 블록만 다루도록 지시하는 프롬프트 헤드 (lab verbatim)."""
    ids = list(focus_ids)
    return (
        f"번호 목록 {ids}에 해당하는 영역만 다룬다. 이 목록에 없는 번호의 영역은 "
        f"절대 요소로 만들지 않는다. 각 요소의 region은 반드시 이 목록 {ids} 중 하나여야 한다. "
        f"box는 그 번호 영역 사각형 안에만.\n"
        f"이 목록의 각 영역이 **키(라벨·제목·항목명)** 인지 "
        f"**값(작성자가 채우는 입력칸·선택지)** 인지 판단해, 값 성격일 때만 입력 요소를 만든다.\n"
        f"번호 0~{max(0, n_atoms - 1)}. key 필드는 넣지 말 것.\n"
    )
