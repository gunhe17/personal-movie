"""DM — 문서 단위 메타 추출 (발행기관·연도·이용/신청 기간·신청방법·문의처).

개별 바우처가 아니라 매뉴얼 전체에 공통 적용되는 값을 문서당 1회 추출한다.
통합 MD 전체를 한 콜로 — 프롬프트는 processing_spec verbatim. 각 값은 리치 필드와
동일한 셀 구조 {value, page, quote}(후속 S2c 스내핑이 quote_pdf·match 부여).
"""
from __future__ import annotations

from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.processing_spec import (
    DM_MAX_TOKENS,
    DM_SYSTEM,
    DM_TASK,
    DOC_META_KEYS,
    TEMPERATURE,
)

_KEY = "meta"


def normalize_meta(raw: dict | None) -> dict:
    """LLM 메타 → 고정 키(DOC_META_KEYS) 맵. 알 수 없는 키 제거, 누락 키는 null 노드."""
    raw = raw if isinstance(raw, dict) else {}
    return {key: raw.get(key) for key in DOC_META_KEYS}


def build_dm_unit(
    *,
    model: str,
    full_doc: str,
) -> BatchUnit:
    return BatchUnit(
        key=_KEY,
        model=model,
        messages=[
            {"role": "system", "content": DM_SYSTEM},
            {"role": "user", "content": DM_TASK.format(document=full_doc)},
        ],
        max_tokens=DM_MAX_TOKENS,
        response_format={"type": "json_object"},
        temperature=TEMPERATURE,
        # 저추론 고정 — thinking 모델은 사고 토큰이 max_tokens 를 함께 먹는다. 미지정으로
        # 두었더니 2048 예산을 사고가 밀어 JSON 이 중간에 끊겼다(8건 중 6건 파싱 실패 실측).
        reasoning={"effort": "low"},
    )


def intersect_meta(m1: dict, m2: dict) -> dict:
    """DM K=2 교집합 (lab E21 오상속 실측 → E22 양방향 검증): 두 실행에서 값이 일치(정규화 동일
    또는 유사도 ≥0.8)하는 키만 채택. 비결정 과추출(모음집형 문서의 특정사업 값)은 교집합에서
    소멸, 진짜 공용 선언은 안정 재현되어 생존. 정밀을 사고 재현을 파는 거래(오상속 > 미상속 비용)."""
    import difflib
    import json as _json
    import re as _re

    def _n(v) -> str:
        s = v if isinstance(v, str) else _json.dumps(v, ensure_ascii=False, sort_keys=True)
        return _re.sub(r"[\s,·･ㆍ()（）%원~∼～「」『』:：/／\-–\.|'’‘\"]", "", s)

    # 한쪽 실행이 통째로 실패(빈 dict)면 교집합이 아니라 '검증 못 함'이다 — 성공한 쪽을
    # 그대로 쓴다. 실패를 불일치로 취급하면 멀쩡히 뽑힌 값까지 버린다(meta 전멸 실측).
    if not m1 or not m2:
        survivor = m1 or m2
        return {key: survivor.get(key) for key in DOC_META_KEYS} if survivor else {
            key: None for key in DOC_META_KEYS
        }

    out: dict = {}
    for key in DOC_META_KEYS:
        a, b = m1.get(key), m2.get(key)
        va = a.get("value") if isinstance(a, dict) else None
        vb = b.get("value") if isinstance(b, dict) else None
        if va is None or vb is None:
            out[key] = None
            continue
        na, nb = _n(va), _n(vb)
        out[key] = a if (na == nb or difflib.SequenceMatcher(None, na, nb).ratio() >= 0.8) else None
    return out


def parse_dm_result(result: UnitResult) -> dict:
    """`run_stage()`(모드 무관)가 돌려준 결과 → 문서 메타 dict. 실패 시 {}."""
    data = parse_json_lenient(result.content)[0] if (result.ok and result.content) else None
    if not isinstance(data, dict):
        return {}
    return normalize_meta(data)
