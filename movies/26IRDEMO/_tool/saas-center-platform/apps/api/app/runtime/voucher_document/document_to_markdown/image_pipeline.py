"""페이지 이미지 파이프라인 — 중첩표 whiteout + marker 치환.

lab image-to-md `pipeline._whiteout_nested` / `process_page` 의 결정론 부분.
LLM 호출은 DocumentToMarkdownService 가 소유한다.
"""
from __future__ import annotations

import re

import cv2
import numpy as np

from . import region_segment

# LLM 이 마커를 변형할 수 있다: [[c1]]·[[ C1 ]]·전각 【C1】 등. 관용적으로 매칭·치환한다.
# 닫는 괄호로 경계를 잡으므로 인덱스 1 이 C10·C11 을 잘못 잡지 않는다.
_ANY_MARKER = re.compile(r"(?:\[\[|【)\s*C\s*\d+\s*(?:\]\]|】)", re.IGNORECASE)


def _marker_index(marker: str) -> str | None:
    m = re.match(r"\[\[C(\d+)\]\]", marker)
    return m.group(1) if m else None


def _marker_pattern(n: str) -> re.Pattern:
    """마커 인덱스 n 의 관용 패턴 — [[C1]] / [[c1]] / [[ C 1 ]] / 【C1】."""
    return re.compile(rf"(?:\[\[|【)\s*C\s*{re.escape(n)}\s*(?:\]\]|】)", re.IGNORECASE)


def decode_png(png_bytes: bytes) -> np.ndarray:
    """PNG bytes → BGR ndarray."""
    arr = np.frombuffer(png_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("failed to decode PNG")
    return img


def encode_png(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise ValueError("failed to encode PNG")
    return buf.tobytes()


def whiteout_nested(img: np.ndarray) -> tuple[np.ndarray, dict[str, tuple[int, int, int, int]], list]:
    """중첩표 컨테이너를 흰색+[[Ci]] 마커로 지운다 → (clean_img, {marker: bbox}, unmatched)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    units, unmatched = region_segment.crop_units(gray)
    if not units:
        return img, {}, list(unmatched)
    out = img.copy()
    markers: dict[str, tuple[int, int, int, int]] = {}
    for i, container in enumerate(units.keys(), 1):
        x0, y0, x1, y1 = (int(v) for v in container)
        cv2.rectangle(out, (x0, y0), (x1, y1), (255, 255, 255), -1)
        cv2.rectangle(out, (x0, y0), (x1, y1), (0, 0, 0), 1)
        marker = f"[[C{i}]]"
        cv2.putText(
            out,
            marker,
            (x0 + 8, (y0 + y1) // 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 0),
            2,
        )
        markers[marker] = (x0, y0, x1, y1)
    return out, markers, list(unmatched)


def crop_bbox(img: np.ndarray, bbox: tuple[int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1 = bbox
    return img[y0:y1, x0:x1]


def strip_outer_fence(text: str) -> str:
    """외곽 ``` / ```markdown fence 만 제거. 본문 중간의 ``` 는 보존."""
    s = text.strip()
    if not s.startswith("```"):
        return s
    lines = s.splitlines()
    if len(lines) < 2:
        return s
    if not lines[-1].strip().startswith("```"):
        return s
    return "\n".join(lines[1:-1]).strip()


def assert_markers_once(
    body: str,
    markers: dict[str, tuple],
) -> None:
    """본문에 각 marker 가 (변형 허용) 정확히 1회. 아니면 ValueError.
    LLM 이 [[c1]]·【C1】 로 변형해도 매칭하되, 누락(0)·중복(2+)은 실패로 본다."""
    for marker in markers:
        n = _marker_index(marker)
        pat = _marker_pattern(n) if n else re.compile(re.escape(marker))
        cnt = len(pat.findall(body))
        if cnt != 1:
            raise ValueError(f"marker {marker} count={cnt} (변형 포함), expected 1")


def substitute_markers(
    body: str,
    replacements: dict[str, str],
) -> str:
    """marker → nested md 치환 (변형 허용). 치환 후 마커 잔존이면 ValueError."""
    out = body
    for marker, nested in replacements.items():
        n = _marker_index(marker)
        if n:
            out = _marker_pattern(n).sub(lambda _m: nested, out)
        else:
            out = out.replace(marker, nested)
    leftover = _ANY_MARKER.findall(out)
    if leftover:
        raise ValueError(f"markers remain after substitute: {leftover}")
    return out
