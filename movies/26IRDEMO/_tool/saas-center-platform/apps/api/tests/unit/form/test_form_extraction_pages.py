from types import SimpleNamespace

from app.runtime.form_template.extraction.service import _resolve_pages


def _range(low, high, *, upper_inc=False):
    # asyncpg Range 의 형태만 흉내낸다 — 상한 배타가 기본
    return SimpleNamespace(
        isempty=False, lower=low, upper=high, lower_inc=True, upper_inc=upper_inc
    )


def test_단일_쪽():
    assert _resolve_pages(SimpleNamespace(page_range=_range(9, 10))) == [9]


def test_여러_쪽():
    assert _resolve_pages(SimpleNamespace(page_range=_range(9, 12))) == [9, 10, 11]


def test_범위_없으면_문서_전체():
    assert _resolve_pages(SimpleNamespace(page_range=None)) is None


def test_계약_밖_rect는_carve하지_않는다():
    # 0~1 밖 좌표를 carve 에 넣으면 clamp 가 가장자리로 접어붙여 납작한 줄이 된다.
    from app.runtime.form_template.extraction.carve_fit import carve_fit_elements

    els = [{"id": "e1", "page": 1, "rect": [0.1, 1.9, 0.2, 0.4], "field_refs": ["a"]}]
    out, fixed = carve_fit_elements(
        png_bytes=b"not-an-image", fields={"a": {"type": "text"}}, elements=els
    )
    assert out[0]["rect"] == [0.1, 1.9, 0.2, 0.4]
    assert fixed == 0
