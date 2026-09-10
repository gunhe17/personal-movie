"""Exner CS 구조요약 (Structural Summary) 계산 — 순수 함수.

입력: confirmed된 응답들의 final_coding_json 리스트
출력: 상단(Location/DQ/Determinants/FQ/Contents) + 기본 비율(R, Lambda, EA, es 등)

Phase 4-1 범위: Upper Section + 기본 비율
Phase 4-3: 하단 클러스터 (Core/Affection/...)
Phase 4-4: 특수 지표 (SCon/DEPI/HVI/...)

설계 원칙:
- 입력 코딩 dict는 RorschachCoding 스키마와 동일 키 (location/dq/determinants/fq/...)
- 결정인은 다중. 메인 결정인은 첫 번째 — 단순화 (Exner 정통은 Pure F가 아니면 모두 weighted)
- ZSum 계산은 카드별 ZW/ZA/ZD/ZS 표 사용. 카드별 표는 함수 내 상수로 정의
"""
from collections import Counter
from typing import Iterable, TypedDict

from app.modules.examination.rorschach.coding_codes import parse_location


# 해석 가능한 최소 반응 수 (Exner CS)
#
# R이 14 미만인 프로토콜은 **해석하지 않고 재실시**한다. 권고가 아니라
# 타당성 규칙이다. R이 작으면 비율이 튀기 때문이다 — R=3에서 X+%는
# 0.33 아니면 0.67 둘 중 하나이고, 그 값이 PTI 판정에 그대로 들어간다.
#
# 타당하지 않은 프로토콜에서 뽑은 지표로 CDSS가 임상가를 틀린 방향으로
# 미는 것이 이 시스템에서 가장 나쁜 실패 모드다.
MIN_INTERPRETABLE_R = 14


def protocol_validity(r: int) -> str:
    """프로토콜 타당성 판정.

        'not_scored'     아직 채점된 반응이 없다 (R=0)
        'insufficient_r' 채점은 했으나 해석 기준에 못 미친다 (0 < R < 14)
        'valid'          해석 가능 (R >= 14)

    R=0과 R<14를 나누는 이유: 전자는 "아직 안 했다"이고 후자는 "했는데
    부족하다"이다. 화면이 다른 안내를 해야 한다 — 후자에만 재실시 권고가 붙는다.
    """
    if r <= 0:
        return "not_scored"
    if r < MIN_INTERPRETABLE_R:
        return "insufficient_r"
    return "valid"


# 조직활동 Z값 — 카드별 ZW/ZA/ZD/ZS.
#
# **출처: 『로르샤하 종합체계 워크북』(Exner) 〈표 6-1〉"각 카드별 조직활동 Z값"
# 94쪽.** `docs/로르샤하 종합체계 워크북-exner_compressed.pdf`
# 2026-08-25에 10장 × 4값 전부 원전과 대조했다.
#
# 유형(같은 책 92쪽):
#   ZW 발달질이 +, o, v/+ 인 전체반응 (DQv는 Z를 절대 안 준다)
#   ZA 인접한 영역의 둘 이상 대상이 의미 있는 관계
#   ZD 인접하지 않은 영역의 둘 이상 대상이 의미 있는 관계
#   ZS 흰 공간과 다른 영역이 통합 (공간만 쓴 반응은 Z를 안 준다)
#
# ⚠️ **두 기준을 함께 만족하면 더 높은 값을 준다**(94쪽). 지금은 임상가가
#    부호 하나를 고르므로 그 선택이 곧 값이다 — 화면이 값을 보여줘야
#    "어느 쪽이 높은지"를 보고 고를 수 있다.
Z_TABLE: dict[int, dict[str, float]] = {
    1:  {"ZW": 1.0, "ZA": 4.0, "ZD": 6.0, "ZS": 3.5},
    2:  {"ZW": 4.5, "ZA": 3.0, "ZD": 5.5, "ZS": 4.5},
    3:  {"ZW": 5.5, "ZA": 3.0, "ZD": 4.0, "ZS": 4.5},
    4:  {"ZW": 2.0, "ZA": 4.0, "ZD": 3.5, "ZS": 5.0},
    5:  {"ZW": 1.0, "ZA": 2.5, "ZD": 5.0, "ZS": 4.0},
    6:  {"ZW": 2.5, "ZA": 2.5, "ZD": 6.0, "ZS": 6.5},
    7:  {"ZW": 2.5, "ZA": 1.0, "ZD": 3.0, "ZS": 4.0},
    8:  {"ZW": 4.5, "ZA": 3.0, "ZD": 3.0, "ZS": 4.0},
    9:  {"ZW": 5.5, "ZA": 2.5, "ZD": 4.5, "ZS": 5.0},
    10: {"ZW": 5.5, "ZA": 4.0, "ZD": 4.5, "ZS": 6.0},
}


# 결정인 색채 가중치 (WSumC 계산용)
COLOR_WEIGHT: dict[str, float] = {
    "FC": 0.5, "CF": 1.0, "C": 1.5, "Cn": 1.5,
}


# Determinants 분류 (es / EA 계산용)
HUMAN_MOVEMENT = {"Ma", "Mp", "Ma-p"}
ANIMAL_MOVEMENT = {"FMa", "FMp", "FMa-p"}
# 무생물운동은 소문자 `m`이다 — 아포스트로피를 붙이지 않는다.
# 워크북 〈표 3-1〉 결정인 기호와 기준(56쪽): "m 무생물운동반응".
# 아포스트로피는 **무채색**에만 붙는다(`C'`·`C'F`·`FC'`, 같은 표 56쪽).
INANIMATE_MOVEMENT = {"ma", "mp", "ma-p"}
ACHROMATIC = {"FC'", "C'F", "C'"}
TEXTURE = {"FT", "TF", "T"}
VISTA = {"FV", "VF", "V"}
SHADING_DIFFUSE = {"FY", "YF", "Y"}
DIMENSION = {"FD"}
REFLECTION = {"Fr", "rF"}
PURE_FORM = {"F"}


class CodingDict(TypedDict, total=False):
    location: str | None
    dq: str | None
    determinants: list[str]
    fq: str | None
    # None(아직 안 봤다) / True(쌍) / False(쌍 아님 확정) — `popular`와 같다.
    # 집계는 True만 센다(`c.get("pair")`의 참·거짓 판정이 그대로 맞다).
    pair: bool | None
    contents: list[str]
    # None(아직 안 봤다) / True(P) / False(P 아님 확정) — schemas.py 참조.
    # **집계는 True만 센다.** None과 False는 둘 다 P가 아니므로 `c.get("popular")`의
    # 참·거짓 판정이 그대로 맞다. 구분이 필요한 곳은 검토·감사추적이지 집계가 아니다.
    popular: bool | None
    z_score: str | None
    special_scores: list[str]


class StructuralSummary(TypedDict):
    # 메타
    R: int
    # 프로토콜 타당성 — 'valid' | 'insufficient_r' | 'not_scored'
    # R<14면 하단 클러스터·특수지표가 봉인된다(MIN_INTERPRETABLE_R 참조).
    validity: str

    # Location
    location: dict[str, int]   # W, D, Dd, S, "W+D"
    Zf: int
    ZSum: float
    ZEst: float

    # DQ
    dq: dict[str, int]   # +, o, v/+, v

    # Determinants (블렌드 포함 raw count)
    determinants: dict[str, int]
    blends: list[str]   # 블렌드 표기 (예: "FM.FC")
    blends_count: int

    # FQ
    fq: dict[str, int]    # +, o, u, -, none
    form_quality_extended: dict[str, int]  # FQx (extended) — 일단 fq와 동일

    # Contents
    contents: dict[str, int]

    # Special Scores (raw count)
    special_scores: dict[str, int]

    # Popular
    P: int

    # Approach (카드별 location 시퀀스)
    approach: dict[int, list[str]]

    # 핵심 비율
    # Lambda는 None일 수 있다 — R=F면 정의되지 않는다(`_lambda` 참조).
    Lambda: float | None
    EA: float
    es: float
    FM: int
    m: int
    SumC_prime: int
    SumT: int
    SumV: int
    SumY: int
    SumM: int
    WSumC: float
    SumShading: int   # C' + T + V + Y

    # 형태질 비율
    X_plus_pct: float    # (FQ+ + FQo) / R
    X_u_pct: float       # FQu / R
    X_minus_pct: float   # FQ- / R
    F_plus_pct: float    # 순수 F 응답 중 FQ+ / 순수 F 응답 수
    P_pct: float         # P / R


# ZEst 표 (Zf 기반) — Exner CS 기준
_ZEST_TABLE: dict[int, float] = {
    1: 0.0, 2: 2.5, 3: 6.0, 4: 10.0, 5: 13.5, 6: 17.0, 7: 20.5, 8: 24.0,
    9: 27.5, 10: 31.0, 11: 34.5, 12: 38.0, 13: 41.5, 14: 45.5, 15: 49.0,
    16: 52.5, 17: 56.0, 18: 59.5, 19: 63.0, 20: 66.5, 21: 70.0, 22: 73.5,
    23: 77.0, 24: 81.0, 25: 84.5, 26: 88.0, 27: 91.5, 28: 95.0, 29: 98.5, 30: 102.5,
}


def _z_estimate(zf: int) -> float:
    """Zf → ZEst (예상값) 매핑. 30 초과는 보간 + extrapolation."""
    if zf <= 0:
        return 0.0
    if zf in _ZEST_TABLE:
        return _ZEST_TABLE[zf]
    # 30 초과는 마지막 두 값의 차이로 선형 외삽
    last = max(_ZEST_TABLE.keys())
    delta = _ZEST_TABLE[last] - _ZEST_TABLE[last - 1]
    return _ZEST_TABLE[last] + (zf - last) * delta


def _split_location(loc: str | None) -> tuple[str | None, bool]:
    """영역 코드 → (채점 범주, 공백 여부). 규칙은 coding_codes가 갖는다.

    저장 검증(schemas.py)과 같은 규칙을 써야 한다 — 저장은 통과했는데
    채점이 못 읽는 값이 있으면 그 반응은 구조요약에서 조용히 사라진다.
    실제로 그런 상태였다: 예전 구현은 ("W","D","Dd") 완전일치만 인정해
    번호가 붙은 값을 전부 버렸고, 실 DB 56건 중 43건이 집계에서 빠져 있었다.
    """
    return parse_location(loc)


def _is_pure_form(determinants: list[str]) -> bool:
    """순수 F 응답인지 — 결정인이 정확히 ['F']인 경우."""
    return determinants == ["F"]


def _wsum_c(determinants: list[str]) -> float:
    """가중 색채 합계: FC=0.5, CF=1.0, C=Cn=1.5."""
    s = 0.0
    for d in determinants:
        if d in COLOR_WEIGHT:
            s += COLOR_WEIGHT[d]
    return s


def _is_blend(determinants: list[str]) -> bool:
    """블렌드 — 결정인 종류가 2개 이상의 카테고리에 걸쳐 있을 때.

    단순화: 결정인 리스트 길이가 2 이상이면 블렌드로 간주.
    실제 Exner는 카테고리(M/FM/m/색/색조/공간 등) 기준으로 판단하지만
    Phase 4-1에선 단순 길이로.
    """
    return len(determinants) >= 2


# --- GHR/PHR (Human Representational Variable) ---
#
# Perry & Viglione의 인간표상변인. Exner CS 대인관계 클러스터에 들어간다.
#
# ⚠️ **반응 단위 판정이다.** 집계값(summary)으로는 계산할 수 없다 — 한 반응의
# FQ·내용·특수점수·Popular를 **함께** 봐야 하기 때문이다. 그래서 이 함수들은
# 집계가 아니라 `codings` 원본을 받는다.
#
# **출처: 『로르샤하 종합체계 워크북』(Exner) 제7장 특수점수, 〈표 7-1〉(110~111쪽).**
# `docs/로르샤하 종합체계 워크북-exner_compressed.pdf` — 판정 대상 3준거는 110쪽,
# 7단계 표는 110~111쪽, 검증용 예 4개는 111쪽에 있다.
#
# ⚠️ 규칙을 고칠 일이 생기면 **원전을 다시 펴고 고친다.** 기억으로 고치지 않는다 —
# 처음 구현할 때 그렇게 했다가 판정 대상 준거에서 `m`(무생물운동)을 잘못 포함시켰다.

#: 사람 표상으로 세는 내용 부호
_HUMAN_CONTENTS = frozenset({"H", "(H)", "Hd", "(Hd)", "Hx"})
#: 인간운동 결정인
_M_DETERMINANTS = frozenset({"Ma", "Mp", "Ma-p"})
#: 동물운동(FM) 결정인 — COP/AG가 붙을 때만 판정 대상이 된다.
#:
#: ⚠️ **m(무생물운동)은 여기 없다.** 워크북 110쪽 준거 3은 "COP나 AG 특수점수를
#: 포함하는 **FM반응**"이라고 FM만 지목한다. 처음엔 기억에 기대 `ma`·`mp`·
#: `ma-p`를 넣었는데, 그러면 사람이 개입하지 않은 무생물 움직임까지 인간표상으로
#: 세어 GHR:PHR의 분모가 부풀었다.
_FM_DETERMINANTS = frozenset({"FMa", "FMp", "FMa-p"})
#: 수준 2 인지적 특수점수 — 하나라도 있으면 PHR (2단계)
_LEVEL2_SPECIALS = frozenset({"DV2", "DR2", "INCOM2", "FABCOM2"})
#: 인지적 특수점수 → WSum6 가중치. **이 dict가 목록의 유일한 출처다.**
#:
#: 예전에는 같은 열 개짜리 목록이 세 벌 있었다 — GHR:PHR 1단계가 쓰는 집합,
#: Sum6를 세는 리스트, WSum6의 가중치 dict. 부호가 하나 늘거나 이름이 바뀌면
#: 한 벌만 고쳐도 나머지가 **조용히 옛 목록으로 세다가** Sum6와 WSum6가 서로
#: 다른 모집단을 보게 된다. 목록과 가중치를 한 자리에 둔다.
_COGNITIVE_SPECIAL_WEIGHTS: dict[str, int] = {
    "DV1": 1, "DV2": 2,
    "INCOM1": 2, "INCOM2": 4,
    "DR1": 3, "DR2": 6,
    "FABCOM1": 4, "FABCOM2": 7,
    "ALOG": 5, "CONTAM": 7,
}
#: 1단계에서 "DV1 말고는 없어야 한다"의 대상이 되는 인지적 특수점수 전체
_COGNITIVE_SPECIALS = frozenset(_COGNITIVE_SPECIAL_WEIGHTS)
#: 5단계 — 평범반응이면 GHR로 보는 카드 (워크북 111쪽: "카드 III, IV, VII, IX")
#:
#: **자의적인 목록이 아니다.** 평범반응 표(〈표 5-2〉 89쪽)에서 **인간표상이
#: 평범반응인 카드가 정확히 이 넷**이다:
#:   III D9  인간상이나 인형·만화
#:   IV  W/D7 인간이나 거인
#:   VII D9  사람의 머리나 얼굴
#:   IX  D3  인간 또는 인간과 유사한 형상
#: 나머지 카드의 평범반응은 박쥐·나비·동물·가죽·게·거미라 사람이 아니다.
_GHR_POPULAR_CARDS = frozenset({3, 4, 7, 9})


def _is_human_representational(coding: CodingDict) -> bool:
    """이 반응이 GHR/PHR 판정 대상인가.

    워크북 110쪽의 세 준거 중 하나면 대상이다:
      1. 인간내용 기호를 포함하는 반응 — H, (H), Hd, (Hd), Hx
      2. 결정인에 M을 포함하는 반응
      3. COP나 AG 특수점수를 포함하는 **FM반응**

    대상이 아닌 반응은 **어느 쪽으로도 세지 않는다.** GHR도 PHR도 아닌 것이지
    GHR이 0이라는 뜻이 아니다.
    """
    contents = set(coding.get("contents") or [])
    if contents & _HUMAN_CONTENTS:
        return True

    determinants = set(coding.get("determinants") or [])
    if determinants & _M_DETERMINANTS:
        return True

    if determinants & _FM_DETERMINANTS:
        specials = set(coding.get("special_scores") or [])
        if "COP" in specials or "AG" in specials:
            return True

    return False


def _classify_ghr_phr(coding: CodingDict, card_no: int) -> str:
    """한 반응을 GHR / PHR로 가른다. 대상 여부는 부르는 쪽이 이미 걸렀다고 본다.

    **순서가 규칙의 일부다** — 위에서부터 처음 걸리는 단계가 답이고, 아래
    단계는 보지 않는다. 조건들이 겹치기 때문에 순서를 바꾸면 답이 달라진다.
    (예: COP와 AG가 함께 있으면 3단계에서 안 걸리고 6단계에서 PHR이 된다.)
    """
    contents = set(coding.get("contents") or [])
    specials = set(coding.get("special_scores") or [])
    fq = coding.get("fq")

    # 1단계 — 온전한 순수 인간상: Pure H + 형태질 양호 + 잡음 없음
    #   "DV1은 봐준다"가 규칙의 일부다. 가장 가벼운 일탈이라 다른 조건이 다
    #   깨끗하면 좋은 표상으로 본다.
    if (
        "H" in contents
        and fq in ("+", "o", "u")
        and not (specials & (_COGNITIVE_SPECIALS - {"DV1"}))
        and "AG" not in specials
        and "MOR" not in specials
    ):
        return "GHR"

    # 2단계 — 형태를 잃었거나 사고가 심하게 일탈: 무조건 PHR
    #   fq None은 "아직 안 매김"이 아니라 여기서는 'none'과 같이 다룬다.
    #   ⚠️ 미채점 반응이 여기 오면 안 된다 — 확정 게이트가 막는다(completion.py).
    if fq in ("-", "none", None):
        return "PHR"
    if specials & _LEVEL2_SPECIALS:
        return "PHR"
    if "ALOG" in specials or "CONTAM" in specials:
        return "PHR"

    # 3단계 — 협력적 상호작용. AG가 함께 있으면 여기서 안 걸린다.
    if "COP" in specials and "AG" not in specials:
        return "GHR"

    # 4단계 — 손상·비현실적 결합, 해부 내용
    if specials & {"FABCOM1", "FABCOM2"}:
        return "PHR"
    if "MOR" in specials:
        return "PHR"
    if "An" in contents:
        return "PHR"

    # 5단계 — 그 카드의 평범반응이면 관습적 표상으로 본다
    if coding.get("popular") and card_no in _GHR_POPULAR_CARDS:
        return "GHR"

    # 6단계 — 공격성·부적절한 결합·부분 인간
    #   Hd는 PHR이지만 (Hd)는 아니다. 괄호는 가공의 것이라 다른 축이다.
    if "AG" in specials:
        return "PHR"
    if specials & {"INCOM1", "INCOM2", "DR1", "DR2"}:
        return "PHR"
    if "Hd" in contents:
        return "PHR"

    # 7단계 — 나머지
    return "GHR"


def count_ghr_phr(
    codings: list[CodingDict], card_nos: list[int]
) -> tuple[int, int]:
    """프로토콜 전체의 (GHR, PHR) 개수.

    길이가 어긋나면 조용히 짧은 쪽에 맞추지 않는다 — 반응 하나가 통째로
    빠진 채 계산되고, 그건 결과를 보고 알 수 없다.
    """
    if len(codings) != len(card_nos):
        raise ValueError("codings와 card_nos 길이가 다릅니다.")

    ghr = 0
    phr = 0
    for coding, card_no in zip(codings, card_nos):
        if not _is_human_representational(coding):
            continue
        if _classify_ghr_phr(coding, card_no) == "GHR":
            ghr += 1
        else:
            phr += 1
    return ghr, phr


def calculate_structural_summary(
    codings: Iterable[CodingDict],
    card_nos: Iterable[int],
) -> StructuralSummary:
    """응답들의 코딩 + 카드번호로부터 구조요약 계산.

    Args:
        codings: 각 응답의 final_coding (dict). 길이 = R.
        card_nos: 각 응답의 카드 번호 (1..10). 길이 = R, codings와 같은 순서.
    """
    codings_list = list(codings)
    card_list = list(card_nos)
    if len(codings_list) != len(card_list):
        raise ValueError("codings와 card_nos 길이가 다릅니다.")

    R = len(codings_list)

    # Location
    loc_counter: Counter[str] = Counter()
    s_count = 0
    approach: dict[int, list[str]] = {}
    for coding, card_no in zip(codings_list, card_list):
        base, has_s = _split_location(coding.get("location"))
        if base:
            loc_counter[base] += 1
        if has_s:
            s_count += 1
        approach.setdefault(card_no, []).append(coding.get("location") or "?")

    location = {
        "W": loc_counter.get("W", 0),
        "D": loc_counter.get("D", 0),
        "Dd": loc_counter.get("Dd", 0),
        "S": s_count,
        "W+D": loc_counter.get("W", 0) + loc_counter.get("D", 0),
    }

    # Z scores
    zf = 0
    z_sum = 0.0
    for coding, card_no in zip(codings_list, card_list):
        z = coding.get("z_score")
        if z and card_no in Z_TABLE and z in Z_TABLE[card_no]:
            zf += 1
            z_sum += Z_TABLE[card_no][z]
    z_est = _z_estimate(zf)

    # DQ
    dq_counter: Counter[str] = Counter()
    for coding in codings_list:
        if coding.get("dq"):
            dq_counter[coding["dq"]] += 1
    dq = {
        "+": dq_counter.get("+", 0),
        "o": dq_counter.get("o", 0),
        "v/+": dq_counter.get("v/+", 0),
        "v": dq_counter.get("v", 0),
    }

    # Determinants raw count + blends
    det_counter: Counter[str] = Counter()
    blends_list: list[str] = []
    for coding in codings_list:
        dets = coding.get("determinants") or []
        for d in dets:
            det_counter[d] += 1
        if _is_blend(dets):
            blends_list.append(".".join(dets))

    # 카테고리별 합계
    sum_M = sum(det_counter[d] for d in HUMAN_MOVEMENT)
    sum_FM = sum(det_counter[d] for d in ANIMAL_MOVEMENT)
    # 무생물운동 — 집합으로 센다.
    #
    # ⚠️ 예전에는 `k.startswith("m'")`였다. 어휘가 `m'a`였을 때의 임시방편인데,
    # 표기를 워크북대로 `ma`로 고치는 순간 **조용히 0이 된다** — 어디서도
    # 터지지 않고 es·EB만 틀리게 나온다. 어휘는 한 곳(`INANIMATE_MOVEMENT`)에서
    # 온다.
    sum_m = sum(det_counter[d] for d in INANIMATE_MOVEMENT)
    sum_C_prime = sum(det_counter[d] for d in ACHROMATIC)
    sum_T = sum(det_counter[d] for d in TEXTURE)
    sum_V = sum(det_counter[d] for d in VISTA)
    sum_Y = sum(det_counter[d] for d in SHADING_DIFFUSE)
    # **순수 형태반응의 수 — 반응 단위다**(워크북 128쪽 L 정의).
    # 예전에는 `det_counter["F"]`, 즉 부호 'F'의 출현 횟수였다. Exner에서 F는
    # 언제나 단독이라(125쪽 예시의 혼합 결정인에도 F가 없다) 유효한 자료에서는
    # 두 값이 같지만, `["M","F"]` 같은 코딩이 들어오면 그 반응이 순수 형태로
    # 세어져 Lambda가 부푼다. 실제로 옛 목업이 만든 그런 코딩이 DB에 있었다.
    sum_pure_F = sum(1 for c in codings_list if (c.get("determinants") or []) == ["F"])

    # WSumC (가중 색채 합)
    w_sum_c = 0.0
    for coding in codings_list:
        w_sum_c += _wsum_c(coding.get("determinants") or [])

    # FQ
    fq_counter: Counter[str] = Counter()
    for coding in codings_list:
        f = coding.get("fq")
        if f:
            fq_counter[f] += 1
    fq = {
        "+": fq_counter.get("+", 0),
        "o": fq_counter.get("o", 0),
        "u": fq_counter.get("u", 0),
        "-": fq_counter.get("-", 0),
        "none": fq_counter.get("none", 0),
    }

    # 순수 F 응답들의 FQ — F+%
    pure_F_fq: Counter[str] = Counter()
    for coding in codings_list:
        if _is_pure_form(coding.get("determinants") or []):
            f = coding.get("fq")
            if f:
                pure_F_fq[f] += 1
    pure_F_total = sum(pure_F_fq.values())
    f_plus_pct = (pure_F_fq.get("+", 0) + pure_F_fq.get("o", 0)) / pure_F_total if pure_F_total > 0 else 0.0

    # Contents
    contents_counter: Counter[str] = Counter()
    for coding in codings_list:
        for c in coding.get("contents") or []:
            contents_counter[c] += 1

    # Special Scores
    special_counter: Counter[str] = Counter()
    for coding in codings_list:
        for s in coding.get("special_scores") or []:
            special_counter[s] += 1

    # Popular
    P = sum(1 for c in codings_list if c.get("popular"))

    # 비율
    Lambda = _lambda(sum_pure_F, R)
    sum_shading = sum_C_prime + sum_T + sum_V + sum_Y
    EA = sum_M + w_sum_c
    es = sum_FM + sum_m + sum_shading

    fq_extended_total = R if R > 0 else 1
    x_plus = (fq.get("+", 0) + fq.get("o", 0)) / fq_extended_total
    x_u = fq.get("u", 0) / fq_extended_total
    x_minus = fq.get("-", 0) / fq_extended_total
    p_pct = P / fq_extended_total

    return StructuralSummary(
        R=R,
        validity=protocol_validity(R),
        location=location,
        Zf=zf,
        ZSum=round(z_sum, 1),
        ZEst=round(z_est, 1),
        dq=dq,
        determinants=dict(det_counter),
        blends=blends_list,
        blends_count=len(blends_list),
        fq=fq,
        form_quality_extended=fq,
        contents=dict(contents_counter),
        special_scores=dict(special_counter),
        P=P,
        approach=approach,
        Lambda=round(Lambda, 2) if Lambda is not None else None,
        EA=round(EA, 1),
        es=es,
        FM=sum_FM,
        m=sum_m,
        SumC_prime=sum_C_prime,
        SumT=sum_T,
        SumV=sum_V,
        SumY=sum_Y,
        SumM=sum_M,
        WSumC=round(w_sum_c, 1),
        SumShading=sum_shading,
        X_plus_pct=round(x_plus, 2),
        X_u_pct=round(x_u, 2),
        X_minus_pct=round(x_minus, 2),
        F_plus_pct=round(f_plus_pct, 2),
        P_pct=round(p_pct, 2),
    )


# === Phase 4-3 / 4-4: Lower Section + Special Indices ===


# D Score 변환 표 (EA - es) → D
# Exner CS의 표준 변환표 (단순화 — 0±2.5 범위)
def _active_passive(summary: StructuralSummary) -> tuple[int, int]:
    """능동:수동 운동 개수 (a:p).

    CDI 항목 4가 `passive > active + 1`을 보고, 구조요약도 같은 값을 낸다.
    두 곳이 각자 세면 어긋나므로 여기 한 곳에 둔다.
    """
    active_keys = ("Ma", "FMa", "ma", "Ma-p", "FMa-p", "ma-p")
    passive_keys = ("Mp", "FMp", "mp", "Ma-p", "FMa-p", "ma-p")
    det = summary["determinants"]
    return (
        sum(det.get(k, 0) for k in active_keys),
        sum(det.get(k, 0) for k in passive_keys),
    )


def _parse_d_score(value: str | int) -> int:
    """AdjD/D 표시값("+1", "-2", "0")을 정수로. 못 읽으면 0."""
    try:
        return int(str(value).replace("+", "").strip())
    except (ValueError, AttributeError):
        return 0


def _to_d_score(ea: float, es: float) -> int:
    diff = ea - es
    # |diff| / 2.5 반올림 (부호 유지) — 단순화
    if diff >= 0:
        if diff < 0.5: return 0
        if diff < 3.0: return 1
        if diff < 5.5: return 2
        if diff < 8.0: return 3
        if diff < 10.5: return 4
        return 5
    else:
        adiff = -diff
        if adiff < 0.5: return 0
        if adiff < 3.0: return -1
        if adiff < 5.5: return -2
        if adiff < 8.0: return -3
        if adiff < 10.5: return -4
        return -5


#: 정의되지 않는 Lambda의 표시 기호. 화면·PDF가 같은 것을 보게 한 곳에 둔다.
LAMBDA_UNDEFINED = "∞"


#: 형태를 "적절히 사용한" FQ — XA%·WDA%의 분자가 세는 것(워크북 133쪽).
#: `-`와 `none`이 빠진다.
FQ_APPROPRIATE = ("+", "o", "u")


def _fq_appropriate(codings: list[CodingDict]) -> int:
    return sum(1 for c in codings if c.get("fq") in FQ_APPROPRIATE)


def _wda_pct(codings: list[CodingDict]) -> float | None:
    """WDA% — **W·D 영역을 쓴 반응 중** 형태를 적절히 사용한 비율.

    **출처: 워크북 133쪽 〈중재영역〉 2번.**

        WDA% = (W+D반응 중 FQ가 +, o, u인 반응의 합) / (W+D 반응의 합)

    같은 쪽 예시로 대조: W·D 반응 15개 중 12개가 o 혹은 u → 0.80.
    (같은 프로토콜의 XA%는 0.71이다 — **두 값은 다르다.**)

    Dd는 분모에서 빠진다. 흔치 않은 영역에서의 형태 왜곡을 걷어내고 보는
    지표이기 때문이다 — 그래서 보통 XA%보다 높다.

    W·D 반응이 하나도 없으면 정의되지 않는다(`None`). 0을 내면 "그 영역들을
    다 틀리게 봤다"는 뜻이 되어 정반대다 — Lambda와 같은 자리다.
    """
    wd = [c for c in codings if _split_location(c.get("location"))[0] in ("W", "D")]
    if not wd:
        return None
    return round(_fq_appropriate(wd) / len(wd), 2)


def _pure_c(summary: "StructuralSummary") -> int:
    """Pure C — 형태가 붙지 않은 순수 색채반응. **`Cn`도 여기 든다.**

    `Cn`(색채명명)은 형태를 전혀 쓰지 않으므로 순수 색채로 센다. 이 정의가
    표시(정서 클러스터 `FC:CF+C`·`Pure C`)와 판정(CDI `Weighted Sum C < 2.5`
    계열, DEPI `CF+C > FC`)에 함께 쓰이는데 두 자리에 각각 적혀 있었다 —
    `Cn`을 빼거나 넣는 판단이 한쪽에서만 바뀌면 두 값이 조용히 갈린다.
    """
    return summary["determinants"].get("C", 0) + summary["determinants"].get("Cn", 0)


def _egocentricity(codings: list[dict], fr_rf: int, r: int) -> float:
    """자아중심성 지표 3r+(2)/R — **소수 2자리로 반올림한 값이 정본이다.**

    **출처: 워크북 125쪽 〈구조적 요약: 상단부〉 예시 + 137쪽 워크시트.**

        3r+(2)/R = (3 × (Fr+rF) + (2)의 수) / R

    125쪽 예시로 대조: R=17, Fr+rF=1, (2)=3 → 6/17 = 0.3529… → **인쇄값 `0.35`**.

    **왜 반올림한 값으로 판정하나.** 137쪽 〈Constellation Worksheet〉는 이 값을
    S-CON(`< .31 or > .44`)과 DEPI(`> .44 and Fr+rF=0` / `< .33`)에서 쓰는데,
    항목 옆에 값을 다시 적는 칸이 없다 — `Sum PTI` 한 칸을 빼면 워크시트 전체가
    체크박스뿐이다. **입력은 구조적 요약에 인쇄된 숫자 그 자체다.**

    예전에는 표시만 `round(…, 2)`하고 판정은 원값을 봤다. 그래서 화면에 `0.44`가
    찍혀 있는데 `3r+(2)/R > .44` 항목이 켜질 수 있었다(0.4449…). 임상가가 표를
    보고 판정을 되짚을 수 없고, **어긋났다는 사실 자체가 안 보인다** — 표도
    판정도 각각은 멀쩡해 보인다.

    R=0이면 0을 낸다. 이 함수를 부르는 자리는 둘 다 R을 이미 검사하므로
    실제로는 닿지 않는다(특수지표는 R<14에서 먼저 봉인된다).
    """
    if r <= 0:
        return 0.0
    pair_count = sum(1 for c in codings if c.get("pair"))
    return round((3 * fr_rf + pair_count) / r, 2)


def _zd(summary: "StructuralSummary") -> float:
    """Zd = ZSum − ZEst. 125쪽 예시: 51.0 − 49.0 = **+2.0**.

    표시(정보처리 클러스터)와 판정(S-CON `Zd > +3.5 or < −3.5`, HVI (3),
    OBS (3))이 각각 계산하고 있었다. 값은 같았지만 한쪽만 고치면 조용히
    갈리는 자리다 — `_egocentricity`와 같은 이유로 한 곳에 모은다.
    """
    return round(summary["ZSum"] - summary["ZEst"], 1)


def _lambda(pure_f: int, r: int) -> float | None:
    """Lambda(L) — 전체 반응에서 순수 형태반응이 차지하는 비율.

    **출처: 『로르샤하 종합체계 워크북』(Exner) 128쪽, 〈구조적 요약: 하단부〉
    핵심영역 1번.** `docs/로르샤하 종합체계 워크북-exner_compressed.pdf`

        L = F(순수 형태반응의 수) / (R−F)(전체 반응수 − 순수 형태반응의 수)

    같은 쪽 예시로 대조했다: R=17, F=6 → 6/11 = 0.55.
    "심리적 자원의 경제적 사용과 관련이 있다" — 값이 클수록 형태에 기댄다.

    **R = F(모든 반응이 순수 형태)이면 정의되지 않는다 — None을 낸다.**
    예전에는 `0.0`이었다. 0.0은 "순수 형태반응이 하나도 없다"는 뜻이라
    **정반대 소견**이다. 실제로는 형태 편중이 극단에 있는 상태이고, 그건
    빈 값이 아니라 그 자체로 강한 임상 신호다.
    워크북은 이 경우를 다루지 않는다(분모가 0이라 나눌 수 없다는 것뿐이다).
    값을 지어내지 않고 "정의되지 않음"으로 내보내고, 화면·PDF가 ∞로 읽는다.
    """
    denom = r - pure_f
    if denom <= 0:
        return None
    return pure_f / denom


def _eb_per(sum_m: float, w_sum_c: float, ea: float, lam: float | None) -> float | None:
    """EBPer — EB 양식 중 우세한 것이 있는가.

    **출처: 워크북 129쪽 핵심영역 4번.** EBPer는 "EB에 기초하여 특징적인
    양식이 나타나는 **경우에만** 계산한다". 세 준거를 모두 만족해야 한다:

        1. EA ≥ 4.0
        2. Lambda < 1.0
        3. EA가 4.0~10.0이면 EB 두 값의 차이 ≥ 2.0
           EA가 10.0 이상이면 차이 ≥ 2.5

    셋을 만족하면 "EB의 두 값 중 큰 점수에서 작은 점수를 나눈 것"이 값이다.
    같은 쪽 예시로 대조: EA=11.0, L=0.55, EB=7:4.0 → 차이 3.0 → 7/4.0 = 1.8.
    (**소수 1자리다.** 예시가 1.75가 아니라 1.8이라고 못박는다.)

    예전에는 준거 1만 보고 2·3이 없었다 — **계산하면 안 되는 프로토콜에서도
    값이 나왔다.** `sum_m == 0 or w_sum_c == 0`은 0나눗셈 방지일 뿐 원전
    준거가 아니다.

    미해당은 `None`이다. 예전의 `0.0`은 값처럼 읽힌다 — "우세한 양식이
    없다"와 "비율이 0이다"는 다르고, 후자는 EBPer에서 나올 수 없는 값이다.
    Lambda가 None(R=F로 정의 불가)이면 준거 2를 만족할 수 없다 —
    형태 편중이 극단인데 "L < 1.0"으로 볼 수는 없다.
    """
    if ea < 4.0:
        return None
    if lam is None or lam >= 1.0:
        return None

    hi, lo = max(sum_m, w_sum_c), min(sum_m, w_sum_c)
    required = 2.5 if ea >= 10.0 else 2.0
    if hi - lo < required:
        return None
    if lo == 0:
        # 원전이 다루지 않는 자리다. 한쪽이 0이면 비율을 만들 수 없다 —
        # 지어내지 않는다(준거 3은 통과할 수 있으므로 실제로 닿는 분기다).
        return None
    return round(hi / lo, 1)


def _afr(card_nos: list[int]) -> float:
    """Affective Ratio = 마지막 3장(VIII, IX, X) 응답수 / 첫 7장(I~VII) 응답수."""
    last3 = sum(1 for c in card_nos if c in (8, 9, 10))
    first7 = sum(1 for c in card_nos if c in (1, 2, 3, 4, 5, 6, 7))
    if first7 == 0:
        return 0.0
    return round(last3 / first7, 2)


def calculate_lower_section(
    codings: list[CodingDict],
    card_nos: list[int],
    summary: StructuralSummary,
) -> dict:
    """Lower Section 7개 클러스터 계산.

    summary는 calculate_structural_summary 결과를 재사용 — 중복 계산 회피.
    """
    R = summary["R"]
    # R<14는 해석하지 않는다 — 튄 비율이 클러스터 값으로 나가면 안 된다.
    # 구조요약(상단 집계)은 계산해 둔다. 임상가가 "몇 개 나왔나"를 봐야
    # 재실시를 판단할 수 있다.
    if protocol_validity(R) != "valid":
        return _empty_lower_section()

    # === Core ===
    sum_m = summary["SumM"]
    w_sum_c = summary["WSumC"]
    ea = summary["EA"]
    es = summary["es"]
    fm = summary["FM"]
    m = summary["m"]
    sum_c_prime = summary["SumC_prime"]
    sum_t = summary["SumT"]
    sum_v = summary["SumV"]
    sum_y = summary["SumY"]

    eb = f"{sum_m}:{w_sum_c}"
    eb_str = f"{fm + m}:{sum_c_prime + sum_t + sum_v + sum_y}"

    # Adj es: m + Sum(Y) 1개 초과분, T 1개 초과분 빼기
    adj_es = es - max(0, m - 1) - max(0, sum_y - 1)
    adj_d = _to_d_score(ea, adj_es)
    d_score = _to_d_score(ea, es)
    eb_per = _eb_per(sum_m, w_sum_c, ea, summary["Lambda"])

    # === Affection ===
    fc = summary["determinants"].get("FC", 0)
    cf = summary["determinants"].get("CF", 0)
    pure_c = _pure_c(summary)
    fc_cf_c = f"{fc}:{cf + pure_c}"

    # SumC: 색조 기반 색채 (FC' + C'F + C') — 무채색 합 (참조 코드 정의 따름)
    # 우리는 Single C(전체)와 비교. SumC:WSumC = pure_C + CF + FC : WSumC
    sum_c_strict = pure_c + cf + fc
    sum_c_wsum_c = f"{sum_c_strict}:{w_sum_c}"

    afr = _afr(card_nos)
    s_count = summary["location"].get("S", 0)
    blends_count = summary["blends_count"]
    blends_r = f"{blends_count}:{R}"
    cp = summary["special_scores"].get("CP", 0)

    # === Interpersonal ===
    a_count, p_count = _active_passive(summary)
    a_p_str = f"{a_count}:{p_count}"

    ma_count = summary["determinants"].get("Ma", 0) + summary["determinants"].get("Ma-p", 0)
    mp_count = summary["determinants"].get("Mp", 0) + summary["determinants"].get("Ma-p", 0)
    ma_mp_str = f"{ma_count}:{mp_count}"

    cop = summary["special_scores"].get("COP", 0)
    ag = summary["special_scores"].get("AG", 0)
    food = summary["contents"].get("Fd", 0)

    # GHR/PHR — 반응 단위 판정이라 집계(summary)가 아니라 codings를 본다.
    # 오래 `"?:?"` 문자열이 나갔는데, 그게 PDF·AI 요약까지 그대로 흘렀다.
    # 모른다는 표시가 값처럼 인쇄되는 것이 최악이다(§13 E-3).
    ghr_count, phr_count = count_ghr_phr(codings, card_nos)
    ghr_phr = f"{ghr_count}:{phr_count}"

    # Pure H + (H) + Hd + (Hd)
    pure_h = summary["contents"].get("H", 0)
    h_count_total = pure_h + summary["contents"].get("(H)", 0) + summary["contents"].get("Hd", 0) + summary["contents"].get("(Hd)", 0)

    per = summary["special_scores"].get("PER", 0)

    # ISO Index = (Bt + 2*Cl + Ge + Ls + 2*Na) / R
    bt = summary["contents"].get("Bt", 0)
    cl = summary["contents"].get("Cl", 0)
    ge = summary["contents"].get("Ge", 0)
    ls = summary["contents"].get("Ls", 0)
    na = summary["contents"].get("Na", 0)
    iso_index = round((bt + 2 * cl + ge + ls + 2 * na) / R, 2) if R > 0 else 0

    # === Ideation ===
    # Sum6 / WSum6 — **같은 모집단을 세야 한다.** 목록은 한 곳에만 있다
    # (`_COGNITIVE_SPECIAL_WEIGHTS`). Lv2도 그 목록의 부분집합으로 센다.
    specials = summary["special_scores"]
    sum6 = sum(specials.get(k, 0) for k in _COGNITIVE_SPECIAL_WEIGHTS)
    w_sum6 = sum(specials.get(k, 0) * w for k, w in _COGNITIVE_SPECIAL_WEIGHTS.items())
    lv2 = sum(specials.get(k, 0) for k in _LEVEL2_SPECIALS)

    # 2AB+Art+Ay
    ab = summary["special_scores"].get("AB", 0)
    art = summary["contents"].get("Art", 0)
    ay = summary["contents"].get("Ay", 0)
    ab_art_ay = 2 * ab + art + ay

    mor = summary["special_scores"].get("MOR", 0)

    # M-, Mnone — 응답별 분석 필요. 단순화: 0
    m_minus = 0
    m_none = 0
    for c in codings:
        dets = c.get("determinants") or []
        is_m = any(d in HUMAN_MOVEMENT for d in dets)
        if is_m:
            fq = c.get("fq")
            if fq == "-": m_minus += 1
            elif fq == "none": m_none += 1

    # === Cognitive Mediation ===
    #
    # **출처: 워크북 133쪽 〈중재영역〉 1·2번.** 두 값은 분모가 다르다:
    #
    #     XA%  = (FQ가 +, o, u인 반응의 합) / R
    #     WDA% = (W+D반응 중 FQ가 +, o, u인 반응의 합) / (W+D 반응의 합)
    #
    # 같은 쪽 예시가 둘이 다르다는 것을 그대로 보여준다 —
    # R=17에서 XA% = 12/17 = 0.71, W·D 반응 15개 중 12개라 WDA% = 12/15 = 0.80.
    xa_pct = round(_fq_appropriate(codings) / R, 2)

    # 예전에는 `wda_pct = xa_pct`였다("W+D vs Dd 분류 필요"라는 주석과 함께).
    # 분류는 이미 있었다 — `_split_location`이 W/D/Dd를 가른다.
    # 화면·PDF는 두 값을 독립된 칸으로 보여주고, **PTI 항목 1이 둘을 따로
    # 본다**(`XA% < .70 그리고 WDA% < .75`). 같은 값을 넣으면 그 판정이
    # 한쪽 조건만 두 번 확인하는 셈이 된다.
    wda_pct = _wda_pct(codings)

    # X-% = FQ- / R
    x_minus_pct = summary["X_minus_pct"]

    # S- = 공백(S) 반응 중 FQ-인 응답
    # 공백 판정은 _split_location에 맡긴다. 예전에는 `"S" in loc`로 봤는데
    # 소문자 표기(Dds30)를 놓쳤고, 번호에 S가 섞이면 잘못 잡을 수도 있었다.
    s_minus = 0
    for c in codings:
        _, has_s = _split_location(c.get("location"))
        if has_s and c.get("fq") == "-":
            s_minus += 1

    p = summary["P"]
    x_plus_pct = summary["X_plus_pct"]
    x_u_pct = summary["X_u_pct"]

    # === Information Processing ===
    zf = summary["Zf"]
    w_count = summary["location"].get("W", 0)
    d_count = summary["location"].get("D", 0)
    dd_count = summary["location"].get("Dd", 0)
    w_d_dd = f"{w_count}:{d_count}:{dd_count}"
    w_m = f"{w_count}:{sum_m}"

    zd = _zd(summary)

    psv = summary["special_scores"].get("PSV", 0)
    dq_plus = summary["dq"].get("+", 0)
    dq_v = summary["dq"].get("v", 0)

    # === Self-Perception ===
    fr_rf = summary["determinants"].get("Fr", 0) + summary["determinants"].get("rF", 0)
    egocentricity = _egocentricity(codings, fr_rf, R)

    fd = summary["determinants"].get("FD", 0)
    an = summary["contents"].get("An", 0)
    xy = summary["contents"].get("Xy", 0)
    an_xy = an + xy

    h_paren_h_hd = summary["contents"].get("H", 0)
    h_others = summary["contents"].get("(H)", 0) + summary["contents"].get("Hd", 0) + summary["contents"].get("(Hd)", 0)
    h_ratio_str = f"{h_paren_h_hd}:{h_others}"

    return {
        "core": {
            "R": R,
            "EB": eb,
            "eb": eb_str,
            "FM": fm,
            "m": m,
            # 클러스터 dict는 **표시용**이다(D·AdjD도 이미 문자열). 정의되지
            # 않는 Lambda를 빈 칸으로 두면 "계산 실패"로 읽히는데, 실제로는
            # 형태 편중이 극단에 있다는 강한 소견이다. 기호로 말한다.
            "Lambda": summary["Lambda"] if summary["Lambda"] is not None else LAMBDA_UNDEFINED,
            "EA": ea,
            "es": es,
            "Adjes": adj_es,
            "SumC'": sum_c_prime,
            "SumV": sum_v,
            # 미해당은 "-"로 명시한다. 0으로 두면 계산된 비율처럼 읽힌다
            # (원전은 "특징적인 양식이 나타나는 경우에만 계산한다"고 한다).
            # `or "-"`를 쓰지 않는다 — falsy 검사는 값 0을 미해당으로 삼킨다.
            "EBPer": eb_per if eb_per is not None else "-",
            "D": str(d_score),
            "AdjD": str(adj_d),
            "SumT": sum_t,
            "SumY": sum_y,
        },
        "affection": {
            "FC:CF+C": fc_cf_c,
            "Pure C": pure_c,
            "SumC:WSumC": sum_c_wsum_c,
            "Afr": afr,
            "S": s_count,
            "Blends:R": blends_r,
            "CP": cp,
        },
        "interpersonal": {
            "COP": cop,
            "AG": ag,
            "GHR:PHR": ghr_phr,
            "a:p": a_p_str,
            "Food": food,
            "SumT": sum_t,
            "Human Cont": h_count_total,
            "PureH": pure_h,
            "PER": per,
            "ISO Index": iso_index,
        },
        "ideation": {
            "a:p": a_p_str,
            "Ma:Mp": ma_mp_str,
            "2AB+Art+Ay": ab_art_ay,
            "MOR": mor,
            "Sum6": sum6,
            "Lv2": lv2,
            "WSum6": w_sum6,
            "M-": m_minus,
            "Mnone": m_none,
        },
        "cognitiveMediation": {
            "XA%": xa_pct,
            # 클러스터 dict는 **표시용**이다. 정의되지 않는 값을 빈 칸으로 두면
            # "계산 실패"로 읽히므로 기호로 말한다(EBPer와 같은 규칙).
            # 판정이 쓰는 정본은 이 dict가 아니라 `_wda_pct()` 함수다.
            "WDA%": wda_pct if wda_pct is not None else "-",
            "X-%": x_minus_pct,
            "S-": s_minus,
            "P": p,
            "X+%": x_plus_pct,
            "Xu%": x_u_pct,
        },
        "informationProcessing": {
            "Zf": zf,
            "W:D:Dd": w_d_dd,
            "W:M": w_m,
            "Zd": zd,
            "PSV": psv,
            "DQ+": dq_plus,
            "DQv": dq_v,
        },
        "selfPerception": {
            "3r+(2)/R": egocentricity,
            "Fr+rF": fr_rf,
            "SumV": sum_v,
            "FD": fd,
            "An+Xy": an_xy,
            "MOR": mor,
            "H:(H)+Hd+(Hd)": h_ratio_str,
        },
    }


def _empty_lower_section() -> dict:
    """응답 0개일 때 빈 lower section."""
    return {
        "core": {"R": 0, "EB": "0:0", "eb": "0:0", "FM": 0, "m": 0, "Lambda": 0,
                 "EA": 0, "es": 0, "Adjes": 0, "SumC'": 0, "SumV": 0,
                 "EBPer": 0, "D": "0", "AdjD": "0", "SumT": 0, "SumY": 0},
        "affection": {"FC:CF+C": "0:0", "Pure C": 0, "SumC:WSumC": "0:0",
                      "Afr": 0, "S": 0, "Blends:R": "0:0", "CP": 0},
        # GHR:PHR도 다른 값과 같은 표기를 쓴다. 여기만 "?:?"였는데, 봉인된
        # 클러스터에서 한 칸만 다른 어휘를 쓰면 "이 값만 계산에 실패했다"로
        # 읽힌다 — 실제로는 프로토콜 전체가 봉인된 것이다(R<14).
        "interpersonal": {"COP": 0, "AG": 0, "GHR:PHR": "0:0", "a:p": "0:0",
                          "Food": 0, "SumT": 0, "Human Cont": 0, "PureH": 0,
                          "PER": 0, "ISO Index": 0},
        "ideation": {"a:p": "0:0", "Ma:Mp": "0:0", "2AB+Art+Ay": 0, "MOR": 0,
                     "Sum6": 0, "Lv2": 0, "WSum6": 0, "M-": 0, "Mnone": 0},
        "cognitiveMediation": {"XA%": 0, "WDA%": 0, "X-%": 0, "S-": 0,
                               "P": 0, "X+%": 0, "Xu%": 0},
        "informationProcessing": {"Zf": 0, "W:D:Dd": "0:0:0", "W:M": "0:0",
                                  "Zd": 0, "PSV": 0, "DQ+": 0, "DQv": 0},
        "selfPerception": {"3r+(2)/R": 0, "Fr+rF": 0, "SumV": 0, "FD": 0,
                           "An+Xy": 0, "MOR": 0, "H:(H)+Hd+(Hd)": "0:0"},
    }


# === Special Indices (Phase 4-4) ===

def _item(label: str, met: bool) -> dict:
    """체크리스트 한 줄 — **문장과 판정이 같은 자리에서 나온다.**

    예전에는 조건이 백엔드에, 그 조건의 문장이 프론트 배열에 있었고 둘을 잇는
    것이 `"0"`~`"11"` 문자열 인덱스뿐이었다. 한쪽에 항목을 끼워 넣으면 그
    뒤가 통째로 밀리는데 **아무 데서도 터지지 않는다** — 실제로 HVI는 인덱스
    2부터 밀려서 화면에 "Zf > 12 ✔"가 떴다. Zf는 그 계산에 들어간 적이 없다.
    """
    return {"label": label, "met": met}


def _index(label: str, rule: str, items: list[dict], positive: bool) -> dict:
    """지표 하나 — 항목·판정규칙·양성여부를 함께 낸다.

    **판정을 백엔드가 한다.** 예전에는 화면과 PDF가 각각 "체크 수 ≥ 임계"로
    판정했는데, 원전의 HVI·OBS는 그 형태가 아니다(아래 각 지표 주석 참조).
    임계값 표가 화면·PDF 두 곳에 복제돼 있기도 했다.
    """
    return {"label": label, "rule": rule, "items": items, "positive": positive}


def _met_count(items: list[dict]) -> int:
    return sum(1 for i in items if i["met"])


def calculate_special_indices(
    codings: list[CodingDict],
    card_nos: list[int],
    summary: StructuralSummary,
    lower: dict,
) -> dict:
    """6개 특수 지표.

    **출처: 『로르샤하 종합체계 워크북』(Exner) 〈Constellation Worksheet〉 137쪽.**
    `docs/로르샤하 종합체계 워크북-exner_compressed.pdf`
    2026-08-26에 6개 지표의 모든 항목과 판정 규칙을 원전과 전수 대조했다.

    각 지표는 `{label, rule, items:[{label, met}], positive}`를 낸다 —
    조건·문장·판정이 한 자리에 있다(`_item` 주석 참조).
    """
    R = summary["R"]
    # R<14면 SCZI/DEPI/PTI 등을 내지 않는다 — 근거가 되는 비율 자체가
    # 신뢰할 수 없다. MIN_INTERPRETABLE_R 주석 참조.
    if protocol_validity(R) != "valid":
        return _empty_special_indices()

    # 표시(정보처리·자기지각 클러스터)와 **같은 함수**를 쓴다. 반올림 자리까지
    # 같아야 임상가가 구조적 요약의 숫자로 이 항목들을 되짚을 수 있다
    # (`_egocentricity` 주석 — 원전 워크시트에는 값을 다시 적는 칸이 없다).
    fr_rf = summary["determinants"].get("Fr", 0) + summary["determinants"].get("rF", 0)
    egocentricity = _egocentricity(codings, fr_rf, R)

    sum_v = summary["SumV"]
    sum_t = summary["SumT"]
    fd = summary["determinants"].get("FD", 0)
    sum_y = summary["SumY"]
    sum_c_prime = summary["SumC_prime"]
    fc = summary["determinants"].get("FC", 0)
    cf = summary["determinants"].get("CF", 0)
    pure_c = _pure_c(summary)
    cf_c = cf + pure_c
    blends_count = summary["blends_count"]
    pure_h = summary["contents"].get("H", 0)
    h_paren = summary["contents"].get("(H)", 0)
    hd = summary["contents"].get("Hd", 0)
    hd_paren = summary["contents"].get("(Hd)", 0)
    h_others_total = pure_h + h_paren + hd + hd_paren
    a_content = summary["contents"].get("A", 0)
    ad_content = summary["contents"].get("Ad", 0)
    a_paren = summary["contents"].get("(A)", 0)
    ad_paren = summary["contents"].get("(Ad)", 0)
    cg = summary["contents"].get("Cg", 0)
    s_count = summary["location"].get("S", 0)
    dd_count = summary["location"].get("Dd", 0)
    mor = summary["special_scores"].get("MOR", 0)
    zd = _zd(summary)
    zf = summary["Zf"]
    es = summary["es"]
    ea = summary["EA"]
    p = summary["P"]
    x_plus_pct = summary["X_plus_pct"]
    x_minus_pct = summary["X_minus_pct"]
    afr = lower["affection"]["Afr"]
    cop = summary["special_scores"].get("COP", 0)
    ag = summary["special_scores"].get("AG", 0)
    food = summary["contents"].get("Fd", 0)
    w_sum_c = summary["WSumC"]
    w_sum6 = lower["ideation"]["WSum6"]
    m_minus = lower["ideation"]["M-"]
    lv2 = lower["ideation"]["Lv2"]
    xa_pct = lower["cognitiveMediation"]["XA%"]
    # 클러스터 dict가 아니라 **함수에서 받는다.** 그 dict는 표시용이라
    # 정의되지 않는 WDA%가 `"-"` 문자열로 들어 있다 — 판정이 그것을 숫자와
    # 비교하면 터진다. 값의 정본은 언제나 계산하는 쪽이다.
    wda_pct = _wda_pct(codings)
    fm = summary["FM"]
    m_inan = summary["m"]
    fq_plus = summary["fq"].get("+", 0)

    # 구조적 요약이 이미 세어 둔 값을 읽는다. C'+T+V+Y를 여기서 다시 더하면
    # 음영 결정인이 하나 늘 때 한쪽만 고쳐도 모른다(`StructuralSummary.SumShading`).
    sum_shading = summary["SumShading"]
    ab_art_ay = lower["ideation"]["2AB+Art+Ay"]
    iso_index = lower["interpersonal"]["ISO Index"]
    adj_d = _parse_d_score(lower["core"]["AdjD"])
    a_count, p_count = _active_passive(summary)

    # === S-CON (Suicide Potential) — 12항목, 8개 이상이면 양성 ===
    #
    # ⚠️ 원전에 단서가 하나 더 있다: **"14세 이상의 수검자에게만 적용"**.
    # 지금은 나이를 보지 않는다 — 채점 경로에 내담자 생년월일이 들어오지
    # 않아 별도 설계가 필요하다. 아동 교정점수(원전 각주 *)도 같은 성격이다.
    # 둘 다 미구현이며 `docs/로르샤하-코드점검.md`에 남겼다.
    s_con_items = [
        _item("FV+VF+V+FD > 2", sum_v + fd > 2),
        _item("Color-Shading Blends > 0", _color_shading_blends(codings) > 0),
        _item("3r+(2)/R < .31 또는 > .44", egocentricity < 0.31 or egocentricity > 0.44),
        _item("MOR > 3", mor > 3),
        _item("Zd > +3.5 또는 Zd < -3.5", zd > 3.5 or zd < -3.5),
        _item("es > EA", es > ea),
        _item("CF+C > FC", cf_c > fc),
        _item("X+% < .70", x_plus_pct < 0.70),
        _item("S > 3", s_count > 3),
        _item("P < 3 또는 P > 8", p < 3 or p > 8),
        _item("Pure H < 2", pure_h < 2),
        _item("R < 17", R < 17),
    ]

    # === DEPI (Depression Index) — 7항목, 5개 이상이면 양성 ===
    depi_items = [
        _item("(FV+VF+V > 0) 또는 (FD > 2)", sum_v > 0 or fd > 2),
        _item("(Col-Shd Blends > 0) 또는 (S > 2)", _color_shading_blends(codings) > 0 or s_count > 2),
        _item(
            "(3r+(2)/R > .44 그리고 Fr+rF=0) 또는 3r+(2)/R < .33",
            (egocentricity > 0.44 and fr_rf == 0) or egocentricity < 0.33,
        ),
        _item("(Afr < .46) 또는 (Blends < 4)", afr < 0.46 or blends_count < 4),
        _item("(Sum Shading > FM+m) 또는 (SumC' > 2)", sum_shading > fm + m_inan or sum_c_prime > 2),
        _item("(MOR > 2) 또는 (2×AB+Art+Ay > 3)", mor > 2 or ab_art_ay > 3),
        _item("(COP < 2) 또는 (ISO Index > .24)", cop < 2 or iso_index > 0.24),
    ]

    # === CDI (Coping Deficit Index) — 5항목, 4개 이상이면 양성 ===
    cdi_items = [
        # AdjD를 본다 — D가 아니다. AdjD는 상황적 스트레스(m·Y 초과분)를
        # 걷어낸 값이라 "만성 대처 능력"을 보는 CDI의 기준이다.
        _item("(EA < 6) 또는 (AdjD < 0)", ea < 6 or adj_d < 0),
        _item("(COP < 2) 그리고 (AG < 2)", cop < 2 and ag < 2),
        _item("(WSumC < 2.5) 또는 (Afr < .46)", w_sum_c < 2.5 or afr < 0.46),
        _item("(Passive > Active+1) 또는 (Pure H < 2)", p_count > a_count + 1 or pure_h < 2),
        _item(
            "(SumT > 1) 또는 (Isolate/R > .24) 또는 (Food > 0)",
            sum_t > 1 or iso_index > 0.24 or food > 0,
        ),
    ]

    # === PTI (Perceptual-Thinking Index) — 5항목 ===
    #
    # ⚠️ 원전 워크시트는 PTI에 **양성 임계를 적지 않는다.** 항목 체크박스와
    # `Sum PTI` 한 칸뿐이다(다른 다섯 지표는 "N개 이상이면 체크"를 명시한다).
    # 3을 쓰는 것은 통용 기준이지 이 워크북으로 확인한 값이 아니다 — 임상가
    # 검토 목록으로 넘긴다(§14-16: 확인 못 한 것은 확인 못 했다고 적는다).
    pti_items = [
        # WDA%가 None이면(W·D 반응이 하나도 없다) 이 항목은 만족하지 않는다.
        # 모르는 값을 "작다"로 볼 수는 없다 — Lambda·EBPer와 같은 규칙.
        _item(
            "XA% < .70 그리고 WDA% < .75",
            xa_pct < 0.70 and wda_pct is not None and wda_pct < 0.75,
        ),
        _item("X-% > .29", x_minus_pct > 0.29),
        _item("LVL2 > 2 그리고 FAB2 > 0", lv2 > 2 and _has_fab2_check(summary) > 0),
        _item(
            "(R < 17 그리고 WSum6 > 12) 또는 (R > 16 그리고 WSum6 > 17)",
            (R < 17 and w_sum6 > 12) or (R > 16 and w_sum6 > 17),
        ),
        _item("M- > 1 또는 X-% > .40", m_minus > 1 or x_minus_pct > 0.40),
    ]

    # === HVI (Hypervigilance Index) — 8항목 ===
    #
    # **"1번을 만족시키고 아래 7개 중 최소한 4개가 해당될 경우 체크"**(원전).
    # 단순 개수가 아니다 — (1)이 꺼져 있으면 나머지가 7개 다 켜져도 음성이다.
    # 예전에는 화면·PDF가 `체크 수 >= 4`로 판정해 (1) 없이도 양성이 됐다.
    #
    # 항목 자체도 어긋나 있었다: `Zf > 12`·`Zd > +3.5`·`S > 3`가 **아예 없고**
    # 원전에 없는 `Cn > 0`·`H+(H) > 6`이 그 자리를 차지했다. 화면 라벨은
    # 원전을 따르고 있었으므로 "Zf > 12 ✔"가 Cn 판정으로 켜졌다.
    hd_ad = hd + ad_content
    hvi_items = [
        _item("(필수) FT+TF+T = 0", sum_t == 0),
        _item("Zf > 12", zf > 12),
        _item("Zd > +3.5", zd > 3.5),
        _item("S > 3", s_count > 3),
        _item("H+(H)+Hd+(Hd) > 6", h_others_total > 6),
        _item("(H)+(A)+(Hd)+(Ad) > 3", h_paren + a_paren + hd_paren + ad_paren > 3),
        # 원전은 **비율**이다: `H+A : Hd+Ad < 4:1`. 예전에는 `H+A < Hd+Ad`로
        # 적혀 있어 훨씬 좁은 조건이었다(같은 부등호가 아니다).
        # Hd+Ad가 0이면 비율이 무한대라 4보다 작을 수 없다 — 만족하지 않는다.
        _item("H+A : Hd+Ad < 4:1", hd_ad > 0 and (pure_h + a_content) < 4 * hd_ad),
        _item("Cg > 3", cg > 3),
    ]

    # === OBS (Obsessive Style Index) — 5항목 + 판정 4규칙 ===
    #
    # **원전은 "한 가지 이상 해당될 경우 체크"라는 4개 복합 규칙으로 판정한다.**
    # 단순 개수 임계(예전 화면·PDF는 `>= 1`)로는 성립하지 않는다 — 항목 하나만
    # 켜져도 양성이 됐다.
    #
    # 워크시트가 항목 묶음과 판정 규칙 묶음을 따로 그리므로 여기서도 나눠 낸다.
    obs_base = [
        _item("(1) Dd > 3", dd_count > 3),
        _item("(2) Zf > 12", zf > 12),
        # HVI는 +3.5, OBS는 +3.0이다. 두 지표가 다른 값을 쓴다.
        _item("(3) Zd > +3.0", zd > 3.0),
        _item("(4) Populars > 7", p > 7),
        _item("(5) FQ+ > 1", fq_plus > 1),
    ]
    b1, b2, b3, b4, b5 = (i["met"] for i in obs_base)
    first_four = sum((b1, b2, b3, b4))
    all_five = sum((b1, b2, b3, b4, b5))
    obs_rules = [
        _item("(1)~(5) 모두 해당", all_five == 5),
        _item("(1)~(4) 중 2개 이상 그리고 FQ+ > 3", first_four >= 2 and fq_plus > 3),
        _item("(1)~(5) 중 3개 이상 그리고 X+% > .89", all_five >= 3 and x_plus_pct > 0.89),
        _item("FQ+ > 3 그리고 X+% > .89", fq_plus > 3 and x_plus_pct > 0.89),
    ]

    return {
        "sConstellation": _index(
            "S-CON (자살지표)", "8개 이상 해당", s_con_items, _met_count(s_con_items) >= 8
        ),
        "depi": _index("DEPI (우울지표)", "5개 이상 해당", depi_items, _met_count(depi_items) >= 5),
        "cdi": _index("CDI (대처결함)", "4개 이상 해당", cdi_items, _met_count(cdi_items) >= 4),
        "pti": _index(
            "PTI (지각·사고)",
            "합계 3 이상 (임계는 워크북 미기재 — 임상가 검토 필요)",
            pti_items,
            _met_count(pti_items) >= 3,
        ),
        "hvi": _index(
            "HVI (과잉경계)",
            "(필수) 1번 해당 + 나머지 7개 중 4개 이상",
            hvi_items,
            hvi_items[0]["met"] and _met_count(hvi_items[1:]) >= 4,
        ),
        "obs": _index(
            "OBS (강박양식)",
            "아래 4개 판정 규칙 중 하나 이상 해당",
            obs_base + obs_rules,
            any(r["met"] for r in obs_rules),
        ),
    }


def _empty_special_indices() -> dict:
    """봉인된 프로토콜(R<14)의 특수지표 — **항목이 아예 없다.**

    예전에는 항목 수만큼 빈 문자열을 냈고, 소비자가 그것을 세어
    "S-CON 정상 범위 (0 / 8)"으로 인쇄했다. 빈 값을 세면 음성이 된다.

    이제 `items`가 빈 목록이고 `positive`는 False이며, 무엇보다 소비자가
    `validity`로 먼저 게이트한다(PDF §4·화면 배너). 모양은 계산 결과와
    같게 유지한다 — 봉인일 때만 다른 모양이면 읽는 쪽이 분기를 하나 더 갖는다.
    """
    return {
        key: _index(label, "해석 기준 미달(R<14) — 산출하지 않음", [], False)
        for key, label in (
            ("sConstellation", "S-CON (자살지표)"),
            ("depi", "DEPI (우울지표)"),
            ("cdi", "CDI (대처결함)"),
            ("pti", "PTI (지각·사고)"),
            ("hvi", "HVI (과잉경계)"),
            ("obs", "OBS (강박양식)"),
        )
    }


def _color_shading_blends(codings: list[CodingDict]) -> int:
    """Color-Shading Blends — color 결정인과 shading 결정인 동시 존재."""
    color_set = {"FC", "CF", "C", "Cn"}
    shading_set = {"FC'", "C'F", "C'", "FT", "TF", "T", "FV", "VF", "V", "FY", "YF", "Y"}
    n = 0
    for c in codings:
        dets = set(c.get("determinants") or [])
        if dets & color_set and dets & shading_set:
            n += 1
    return n


def _has_fab2_check(summary: StructuralSummary) -> int:
    return summary["special_scores"].get("FABCOM2", 0)


def _count_fq_plus_overall(codings: list[CodingDict]) -> int:
    return sum(1 for c in codings if c.get("fq") == "+")
