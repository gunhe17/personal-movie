"""LLM 좌표를 CV 로 정밀화 — "LLM=무엇, CV=어디".

LLM 은 무엇이 입력칸인지는 잘 맞히지만 좌표는 눈대중이다. 실측(아동정서발달지원서비스
추천서): 행은 대체로 찾지만 열을 못 맞춘다 — 폭 211px 박스가 들어가야 할 셀은 114px,
가로 오차 25px 초과가 84%(세로는 55%).

배치 규칙은 `document_to_form/pipeline.place_elements` 의 결정 트리를 그대로 쓴다 —
거기가 튜닝된 정본이고, 여기서 다시 발명하면 두 벌이 갈린다. 다만 그쪽은 SoM region
(대구획 LLM 단계 산출)을 전제하므로, region 이 없는 이 경로에서는 bounds 를 주지 않는다:
OCR 탐색 범위 제한과 region 단위 □ 일괄배정만 빠지고 나머지는 동일하다.

정밀화가 실패하거나 CV 가 셀을 못 찾으면 LLM 좌표를 그대로 둔다 — 나빠지지 않는 것이 우선.
"""
from __future__ import annotations

from typing import Any

from app.core.logger import get_logger

logger = get_logger(__name__)

# CV 가 볼 렌더 해상도 — 표시용 150dpi 에서는 얇은 괘선이 뭉개져 셀 검출이 3개까지
# 떨어진다(같은 쪽, 300dpi 에서 32개). rect 는 정규화라 해상도가 달라도 무관하다.
CARVE_DPI = 300

# pipeline.place_elements 와 같은 분류
_BOUND = {"text", "email", "phone", "number", "date", "time"}
_SNAP = {"image"}
_FILL = {"textarea"}


def carve_fit_elements(
    png_bytes: bytes,
    fields: dict[str, Any],
    elements: list[dict],
) -> tuple[list[dict], int]:
    """elements 의 rect(정규화)를 CV 로 정밀화한 새 리스트와 보정 건수."""
    try:
        import cv2
        import numpy as np

        from app.runtime.voucher_document.document_to_form import carve
        from app.runtime.voucher_document.document_to_form.region_segment import segment
    except Exception:  # noqa: BLE001
        logger.warning("carve_fit: CV 스택 사용 불가 — LLM 좌표 유지", exc_info=True)
        return elements, 0

    gray = cv2.imdecode(np.frombuffer(png_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
    if gray is None:
        return elements, 0
    ih, iw = gray.shape[:2]

    try:
        cells = segment(gray).get("cells") or []
    except Exception:  # noqa: BLE001
        logger.warning("carve_fit: 영역 분리 실패 — 셀 기준 보정 생략", exc_info=True)
        cells = []

    out: list[dict] = []
    fixed = 0
    for el in elements:
        rect = el.get("rect")
        if not (isinstance(rect, list) and len(rect) == 4):
            out.append(el)
            continue

        # 계약 밖 rect(0~1 이탈)는 carve 에 넣지 않는다 — 넣으면 clamp 가 이미지
        # 가장자리로 접어붙여 "높이 2px 짜리 바닥 줄"이 되고, 그게 정상 좌표처럼
        # 저장된다(2쪽 서식 실측: 49개 전부 바닥 붙음). 원본을 남겨 눈에 띄게 둔다.
        if not all(0.0 <= c <= 1.0 for c in rect) or rect[2] <= 0 or rect[3] <= 0:
            logger.warning(
                "carve_fit: element=%s rect 가 0~1 밖 %s — 정밀화 생략", el.get("id"), rect
            )
            out.append(el)
            continue

        box = (rect[0] * iw, rect[1] * ih, rect[2] * iw, rect[3] * ih)
        if box[2] <= 1 or box[3] <= 1:
            out.append(el)
            continue

        key = (el.get("field_refs") or [None])[0]
        fdef = (fields.get(key) or {}) if key else {}
        ftype = fdef.get("type", "text")
        opt = el.get("option")
        ct = "text" if ftype == "number" else ftype  # number 배치는 text 경로 (pipeline 과 동일)

        try:
            placed = _place(carve, gray, box, ct, opt, cells, (ih, iw))
        except Exception:  # noqa: BLE001
            logger.warning(
                "carve_fit: element=%s 정밀화 실패 — 원본 유지", el.get("id"), exc_info=True
            )
            out.append(el)
            continue

        x, y, w, h = placed
        new_rect = [
            max(0.0, min(1.0, x / iw)),
            max(0.0, min(1.0, y / ih)),
            max(0.0, min(1.0, w / iw)),
            max(0.0, min(1.0, h / ih)),
        ]
        if new_rect != rect:
            fixed += 1
        out.append({**el, "rect": new_rect})

    return out, fixed


def _place(
    carve,
    gray,
    box,
    ct,
    opt,
    cells,
    hw,
):
    """pipeline.place_elements 의 타입별 배치·후처리 (region/bounds 없는 판)."""
    obox = tuple(int(v) for v in box)
    (rx, ry, rw, rh), _, rule = carve.place(gray, obox, ct, opt, hw)

    if ct in _BOUND and not opt and rule != "_ocr_anchor":
        moved = None
        if ct == "text" and carve.ink_frac(gray, obox) > 0.06:
            # 박스가 인쇄 글자 위에 얹혔다 — 자리표시(○○○)나 라벨 뒤 빈칸으로 옮긴다
            moved = carve.fit_placeholder(gray, obox, hw) or carve.fit_after_label(
                gray, obox, cells
            )
            if moved:
                rx, ry, rw, rh = moved
        if moved is None:
            rx, ry, rw, rh = carve.fit_bounded(gray, (rx, ry, rw, rh), cells)
    elif ct in _SNAP and not opt:
        rx, ry, rw, rh = carve.snap_to_cell((rx, ry, rw, rh), cells)
    elif ct in _FILL and not opt:
        rx, ry, rw, rh = carve.fill_cell((rx, ry, rw, rh), cells)
    elif ct == "signature":
        rx, ry, rw, rh = carve.fit_ink(gray, (rx, ry, rw, rh))

    ih, iw = hw
    x = max(0, min(int(rx), iw - 1))
    y = max(0, min(int(ry), ih - 1))
    return x, y, max(2, min(int(rw), iw - x)), max(2, min(int(rh), ih - y))
