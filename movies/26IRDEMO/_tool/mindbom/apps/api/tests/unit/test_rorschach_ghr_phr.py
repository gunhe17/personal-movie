"""GHR/PHR — 인간표상변인이 실제로 계산되는가.

무엇을 막는 테스트인가
----------------------
`calculate_lower_section`이 GHR:PHR 자리에 **문자열 `"?:?"`를 하드코딩**해서
내보내고 있었다(2026-08-25 발견). 그 값이 대인관계 클러스터를 타고 결과 화면·
PDF·AI 요약까지 그대로 흘렀다.

왜 위험한가: 물음표가 **값처럼 인쇄된다.** 다른 지표는 전부 숫자인데 한 칸만
`?:?`라 임상가는 "이 검사에서만 계산이 안 됐나"로 읽게 되고, 실제로는 어떤
검사에서도 계산된 적이 없었다. 지표가 0으로 죽어 있는 것보다 나쁘다 —
0은 "그런 반응이 없었다"로 읽히기라도 하지만, 물음표는 시스템을 못 믿게 만든다.

이 테스트가 고정하는 것
----------------------
1. 판정 **대상 선별** — 사람 내용 / M / (FM + COP·AG)
2. **7단계의 순서** — 조건이 겹칠 때 위 단계가 이긴다. 순서가 규칙의 일부다.
3. 봉인(R<14)일 때의 표기
4. **워크북이 직접 제시한 예 4개** (111쪽) — 이게 원전이 준 정답지다

출처
----
『로르샤하 종합체계 워크북』(Exner) 제7장, 판정 대상 3준거 110쪽,
〈표 7-1〉 7단계 110~111쪽, 예시 4개 111쪽.
`docs/로르샤하 종합체계 워크북-exner_compressed.pdf`

⚠️ 처음엔 원전 없이 기억으로 구현했다. 7단계 규칙은 맞았지만 **판정 대상에서
`m`(무생물운동)을 잘못 포함**시켰고, 원전 대조에서 잡혔다. 규칙을 고칠 일이
생기면 기억이 아니라 원전을 편다.
"""

import pytest

from app.modules.examination.rorschach.scoring import (
    _classify_ghr_phr,
    _is_human_representational,
    calculate_lower_section,
    calculate_structural_summary,
    count_ghr_phr,
)


def _coding(
    loc="W",
    fq="o",
    dets=None,
    contents=None,
    specials=None,
    popular=False,
):
    return {
        "location": loc,
        "dq": "o",
        "determinants": dets or ["F"],
        "fq": fq,
        "pair": False,
        "contents": contents or ["A"],
        "popular": popular,
        "z_score": None,
        "special_scores": specials or [],
    }


# --- 1. 판정 대상 선별 ---


@pytest.mark.parametrize("content", ["H", "(H)", "Hd", "(Hd)", "Hx"])
def test_사람_내용은_판정_대상이다(content):
    assert _is_human_representational(_coding(contents=[content]))


@pytest.mark.parametrize("det", ["Ma", "Mp", "Ma-p"])
def test_인간운동은_내용과_무관하게_대상이다(det):
    # 동물 내용이라도 M이 있으면 사람 표상으로 본다
    assert _is_human_representational(_coding(dets=[det], contents=["A"]))


@pytest.mark.parametrize("det", ["FMa", "FMp", "FMa-p"])
def test_동물운동은_COP나_AG가_있어야_대상이다(det):
    assert not _is_human_representational(_coding(dets=[det], contents=["A"]))
    assert _is_human_representational(
        _coding(dets=[det], contents=["A"], specials=["COP"])
    )
    assert _is_human_representational(
        _coding(dets=[det], contents=["A"], specials=["AG"])
    )


@pytest.mark.parametrize("det", ["ma", "mp", "ma-p"])
def test_무생물운동은_COP나_AG가_있어도_대상이_아니다(det):
    """워크북 110쪽 준거 3은 **FM반응**만 지목한다.

    처음엔 기억에 기대 m을 넣었다가 원전 대조에서 잡혔다. m까지 세면 사람이
    개입하지 않은 무생물 움직임이 인간표상으로 잡혀 GHR:PHR 분모가 부푼다.
    """
    assert not _is_human_representational(
        _coding(dets=[det], contents=["A"], specials=["COP"])
    )
    assert not _is_human_representational(
        _coding(dets=[det], contents=["A"], specials=["AG"])
    )


def test_대상이_아닌_반응은_어느_쪽으로도_안_센다():
    # 순수 동물 반응 — GHR도 PHR도 아니다
    plain = [_coding() for _ in range(5)]
    assert count_ghr_phr(plain, [1, 2, 3, 4, 5]) == (0, 0)


# --- 2. 단계별 판정 ---


def test_1단계_온전한_순수인간상은_GHR():
    c = _coding(contents=["H"], fq="o")
    assert _classify_ghr_phr(c, 1) == "GHR"


def test_1단계는_DV1만_봐준다():
    # DV1은 통과
    assert _classify_ghr_phr(_coding(contents=["H"], specials=["DV1"]), 1) == "GHR"
    # DR1은 1단계에서 탈락 → 6단계까지 내려가 PHR
    assert _classify_ghr_phr(_coding(contents=["H"], specials=["DR1"]), 1) == "PHR"


def test_1단계는_AG나_MOR이_있으면_탈락한다():
    assert _classify_ghr_phr(_coding(contents=["H"], specials=["AG"]), 1) == "PHR"
    assert _classify_ghr_phr(_coding(contents=["H"], specials=["MOR"]), 1) == "PHR"


@pytest.mark.parametrize("fq", ["-", "none", None])
def test_2단계_형태를_잃으면_PHR(fq):
    # Pure H에 COP까지 있어도 형태질이 무너지면 PHR이다
    c = _coding(contents=["H"], fq=fq, specials=["COP"])
    assert _classify_ghr_phr(c, 1) == "PHR"


@pytest.mark.parametrize("sp", ["DV2", "DR2", "INCOM2", "FABCOM2", "ALOG", "CONTAM"])
def test_2단계_심한_사고일탈은_COP보다_우선한다(sp):
    c = _coding(contents=["H"], specials=[sp, "COP"])
    assert _classify_ghr_phr(c, 1) == "PHR"


def test_3단계_COP는_GHR이지만_AG가_같이_있으면_아니다():
    # (H)는 1단계의 Pure H가 아니므로 3단계까지 내려온다
    assert _classify_ghr_phr(_coding(contents=["(H)"], specials=["COP"]), 1) == "GHR"
    # AG가 함께면 3단계에서 안 걸리고 6단계에서 PHR
    assert (
        _classify_ghr_phr(_coding(contents=["(H)"], specials=["COP", "AG"]), 1)
        == "PHR"
    )


@pytest.mark.parametrize("sp", ["FABCOM1", "FABCOM2", "MOR"])
def test_4단계_손상된_결합은_PHR(sp):
    # FABCOM2는 2단계에서 이미 걸리지만 결과는 같다
    assert _classify_ghr_phr(_coding(contents=["(H)"], specials=[sp]), 1) == "PHR"


def test_4단계_해부내용은_PHR():
    assert _classify_ghr_phr(_coding(contents=["(H)", "An"]), 1) == "PHR"


def test_5단계_평범반응은_해당_카드에서만_GHR():
    # (Hd)는 1단계 대상이 아니고 6단계에서 PHR이 될 내용이 아니다.
    # 카드 III는 GHR 카드, 카드 I은 아니다.
    on_card = _coding(contents=["(Hd)"], popular=True)
    assert _classify_ghr_phr(on_card, 3) == "GHR"
    assert _classify_ghr_phr(on_card, 1) == "GHR"  # 7단계로 떨어져도 GHR


def test_5단계는_6단계보다_먼저다():
    """Hd + Popular — 순서가 뒤집히면 답이 갈린다.

    5단계(카드 III 평범반응 → GHR)가 6단계(Hd → PHR)보다 위에 있다.
    카드 III에서는 GHR, 카드 I에서는 6단계까지 내려가 PHR이 되어야 한다.
    """
    c = _coding(contents=["Hd"], popular=True)
    assert _classify_ghr_phr(c, 3) == "GHR"
    assert _classify_ghr_phr(c, 1) == "PHR"


def test_6단계_Hd는_PHR이지만_괄호Hd는_아니다():
    assert _classify_ghr_phr(_coding(contents=["Hd"]), 1) == "PHR"
    assert _classify_ghr_phr(_coding(contents=["(Hd)"]), 1) == "GHR"


@pytest.mark.parametrize("sp", ["AG", "INCOM1", "DR1"])
def test_6단계_공격성과_부적절한_결합은_PHR(sp):
    assert _classify_ghr_phr(_coding(contents=["(H)"], specials=[sp]), 1) == "PHR"


def test_7단계_나머지는_GHR():
    # 사람 내용은 있고 걸리는 조건이 하나도 없다
    assert _classify_ghr_phr(_coding(contents=["(H)"]), 1) == "GHR"


# --- 3. 집계 ---


def test_길이가_어긋나면_터진다():
    """조용히 짧은 쪽에 맞추면 반응 하나가 통째로 빠진 채 계산된다."""
    with pytest.raises(ValueError):
        count_ghr_phr([_coding(), _coding()], [1])


def test_프로토콜_전체_집계():
    codings = [
        _coding(contents=["H"]),                      # 1단계 GHR
        _coding(contents=["H"], fq="-"),              # 2단계 PHR
        _coding(contents=["(H)"], specials=["COP"]),  # 3단계 GHR
        _coding(contents=["Hd"]),                     # 6단계 PHR
        _coding(),                                    # 대상 아님
    ]
    assert count_ghr_phr(codings, [1, 2, 3, 4, 5]) == (2, 2)


# --- 4. 실제 출력 ---


def _lower(codings):
    """R>=14가 되도록 채워서 lower section을 계산한다."""
    filler = [_coding() for _ in range(max(0, 16 - len(codings)))]
    all_codings = codings + filler
    cards = [(i % 10) + 1 for i in range(len(all_codings))]
    summary = calculate_structural_summary(all_codings, cards)
    return calculate_lower_section(all_codings, cards, summary)


def test_물음표가_더_이상_나가지_않는다():
    lower = _lower([_coding(contents=["H"]), _coding(contents=["Hd"])])
    value = lower["interpersonal"]["GHR:PHR"]
    assert "?" not in value
    assert value == "1:1"


def test_사람_반응이_없으면_0대0():
    """물음표가 아니라 0:0이다 — "그런 반응이 없었다"는 뜻."""
    assert _lower([])["interpersonal"]["GHR:PHR"] == "0:0"


def test_봉인된_프로토콜도_물음표가_아니다():
    """R<14면 클러스터 전체가 봉인된다. 그때도 표기는 다른 값과 같아야 한다."""
    codings = [_coding(contents=["H"]) for _ in range(5)]
    cards = [(i % 10) + 1 for i in range(len(codings))]
    summary = calculate_structural_summary(codings, cards)
    lower = calculate_lower_section(codings, cards, summary)
    assert lower["interpersonal"]["GHR:PHR"] == "0:0"


# --- 5. 워크북 111쪽 예시 — 원전이 준 정답지 ---
#
# 표의 네 줄을 그대로 옮겼다. 우리 해석이 아니라 **책이 답을 적어둔 것**이라,
# 여기가 깨지면 구현이 틀린 것이지 기대값이 틀린 게 아니다.


def test_워크북예시_카드3_FABCOM은_4단계_PHR():
    """III  D+ Ma.FYo 2 H,Cg P 3.0 FABCOM  →  단계 4에서 PHR

    순수 H에 FQo인데 FABCOM이 있다. 1단계는 인지적 특수점수 때문에 탈락,
    2단계는 수준 2가 아니라 통과, 3단계는 COP가 없어 통과, 4단계에서 걸린다.
    **평범반응이지만 5단계(GHR)에 닿기 전에 4단계가 먼저 잡는다** — 순서가 규칙이다.
    """
    c = _coding(fq="o", dets=["Ma", "FY"], contents=["H", "Cg"],
                popular=True, specials=["FABCOM1"])
    assert _is_human_representational(c)
    assert _classify_ghr_phr(c, 3) == "PHR"


def test_워크북예시_카드9_괄호Hd는_7단계_GHR():
    """IX  DSo FC'o (Hd)  →  단계 7에서 GHR

    (Hd)는 6단계의 Hd가 아니다. 걸리는 조건이 하나도 없어 끝까지 내려간다.
    """
    c = _coding(fq="o", dets=["FC'"], contents=["(Hd)"])
    assert _is_human_representational(c)
    assert _classify_ghr_phr(c, 9) == "GHR"


def test_워크북예시_카드8_ALOG는_2단계_PHR():
    """VIII  W+ FMa.FCo 2 A,Bt 4.5 COP,ALOG  →  단계 2에서 PHR

    사람 내용이 없다 — **FM에 COP가 붙어** 판정 대상이 된 경우(준거 3)다.
    COP가 있어 3단계 GHR로 갈 것 같지만 ALOG가 2단계에서 먼저 잡는다.
    """
    c = _coding(fq="o", dets=["FMa", "FC"], contents=["A", "Bt"],
                specials=["COP", "ALOG"])
    assert _is_human_representational(c)
    assert _classify_ghr_phr(c, 8) == "PHR"


def test_워크북예시_카드7_평범반응Hd는_5단계_GHR():
    """VII  D+ Ma.mPo 2 Hd,Art P 3.0 DV  →  단계 5에서 GHR

    Hd라 6단계면 PHR이지만, 카드 VII의 평범반응이라 5단계가 먼저 GHR로 잡는다.
    """
    c = _coding(fq="o", dets=["Ma", "mp"], contents=["Hd", "Art"],
                popular=True, specials=["DV1"])
    assert _is_human_representational(c)
    assert _classify_ghr_phr(c, 7) == "GHR"
