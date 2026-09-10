"""region_segment + whiteout — lab fixture 결정론 테스트."""

from pathlib import Path

import cv2
import pytest

from app.runtime.voucher_document.document_to_markdown import image_pipeline as ip
from app.runtime.voucher_document.document_to_markdown import region_segment

FIXTURES = Path(__file__).parent / "fixtures"


def _gray(name: str):
    img = cv2.imread(str(FIXTURES / name))
    assert img is not None, name
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), img


@pytest.mark.parametrize("name", ["p-007.png", "p-011.png", "p-149.png"])
def test_crop_units_runs(name):
    gray, _ = _gray(name)
    units, unmatched = region_segment.crop_units(gray)
    assert isinstance(units, dict)
    assert isinstance(unmatched, list)


def test_p007_detects_nested_containers():
    """lab 실측: p-007 에 중첩표(가구원수 등) 컨테이너가 있다."""
    gray, img = _gray("p-007.png")
    units, unmatched = region_segment.crop_units(gray)
    clean, markers, um = ip.whiteout_nested(img)
    assert len(markers) == len(units)
    assert um == list(unmatched)
    if units:
        assert markers
        for m, (x0, y0, x1, y1) in markers.items():
            assert m.startswith("[[C")
            assert x1 > x0 and y1 > y0
            crop = ip.crop_bbox(img, (x0, y0, x1, y1))
            assert crop.size > 0
        # whiteout 영역은 거의 흰색
        m0 = next(iter(markers.values()))
        x0, y0, x1, y1 = m0
        region = clean[y0 + 2 : y1 - 2, x0 + 2 : x1 - 2]
        assert float(region.mean()) > 200


def test_strip_outer_fence_only():
    assert ip.strip_outer_fence("```markdown\nhello\n```") == "hello"
    assert ip.strip_outer_fence("no fence") == "no fence"
    # 본문 중간의 fence 보존
    body = "```\nouter\n```"
    assert ip.strip_outer_fence(body) == "outer"
    mixed = "a ```code``` b"
    assert ip.strip_outer_fence(mixed) == mixed


def test_marker_cardinality_and_substitute():
    markers = {"[[C1]]": (0, 0, 1, 1), "[[C2]]": (0, 0, 1, 1)}
    body = "left [[C1]] mid [[C2]] right"
    ip.assert_markers_once(body, markers)
    out = ip.substitute_markers(body, {"[[C1]]": "A", "[[C2]]": "B"})
    assert out == "left A mid B right"
    with pytest.raises(ValueError):
        ip.assert_markers_once("only [[C1]]", markers)
    with pytest.raises(ValueError):
        ip.substitute_markers("[[C1]] [[C2]]", {"[[C1]]": "A"})
