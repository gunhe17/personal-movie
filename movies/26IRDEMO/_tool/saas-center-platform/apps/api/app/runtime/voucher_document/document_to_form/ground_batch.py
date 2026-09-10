"""s3_ground_batch — 블록별(또는 page 모드) 그라운딩 배치 스테이지 + FormSchema 조립.

CV(atoms·segment)는 partition_batch 와 마찬가지로 재계산(저장 안 함). key 규약:
`{page}:{block_index}` (일반) / `{page}:page`(대구획 분리 실패 → 전체 1블록 폴백,
partition_batch.apply_partition_results 의 groups=None과 대응).

block 결과는 region-box clamp(블록 밖 검출 제거) 후 페이지별로 합쳐
dedup_nested + assign_keys(서버 key 부여) →
carve(place_elements) → FormSchema. page 모드도 같은 후처리를 그대로 태운다(단일
블록이라 dedup 은 사실상 no-op) — 두 경로를 갈라 짜지 않는다(ponytail 단순화).
"""
from __future__ import annotations

import numpy as np
import cv2

from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.common.page_markdown import page_num
from app.runtime.voucher_document.common.pdf_processor import PdfProcessor
from app.runtime.voucher_document.processing_spec import MODEL_PRIMARY

from .extract import (
    FORM_GROUND_TEMPERATURE,
    GROUND_MAX_TOKENS,
    GROUND_REASONING,
    GROUND_SYS,
    _focus_head,
    assign_keys,
    ground_response_format,
)
from .ground_focus import (
    MAX_BLOCK,
    _atom_box_1000,
    _b64,
    _clamp_box_to_region,
    _split_big_groups,
    dedup_nested,
    derive_atoms,
    mark_focus_multi,
)
from .pipeline import place_elements, som_mark, to_form_schema
from .region_segment import segment

_PAGE_MODE_TAG = "page"


def _ground_messages(
    *,
    marked_jpg_b64: str,
    focus_ids: list[int] | None,
    n_atoms: int,
) -> list[dict]:
    head = (
        _focus_head(focus_ids, n_atoms)
        if focus_ids is not None
        else f"번호 0~{max(0, n_atoms - 1)}. key 필드는 넣지 말 것.\n"
    )
    return [
        {"role": "system", "content": GROUND_SYS},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": head + "[이미지]↓"},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{marked_jpg_b64}"},
                },
            ],
        },
    ]


def build_ground_units(
    *,
    pdf_bytes: bytes,
    form_pages: list[str],
    partitions: dict[str, list[list[int]] | None],
    model: str = MODEL_PRIMARY,
    max_block: int = MAX_BLOCK,
) -> list[BatchUnit]:
    units: list[BatchUnit] = []
    with PdfProcessor(pdf_bytes) as proc:
        for pid in form_pages:
            num = page_num(pid)
            if num is None or num > proc.page_count:
                continue
            img = _decode_page(proc, num)
            _, color, atoms = derive_atoms(img)
            if not atoms:
                continue  # no_atoms — partition_batch 가 이미 즉시 확정, ground 대상 아님

            groups = partitions.get(pid)
            if not groups:
                marked = som_mark(color, atoms)
                units.append(
                    BatchUnit(
                        key=f"{pid}:{_PAGE_MODE_TAG}",
                        model=model,
                        messages=_ground_messages(
                            marked_jpg_b64=_b64(marked), focus_ids=None, n_atoms=len(atoms)
                        ),
                        max_tokens=GROUND_MAX_TOKENS,
                        temperature=FORM_GROUND_TEMPERATURE,
                        reasoning=GROUND_REASONING,
                        response_format=ground_response_format(),
                    )
                )
                continue

            blocks = _split_big_groups(atoms, groups, cap=max_block)
            for bi, block in enumerate(blocks):
                marked = mark_focus_multi(color, atoms, set(block))
                units.append(
                    BatchUnit(
                        key=f"{pid}:{bi}",
                        model=model,
                        messages=_ground_messages(
                            marked_jpg_b64=_b64(marked), focus_ids=block, n_atoms=len(atoms)
                        ),
                        max_tokens=GROUND_MAX_TOKENS,
                        temperature=FORM_GROUND_TEMPERATURE,
                        reasoning=GROUND_REASONING,
                        response_format=ground_response_format(),
                    )
                )
    return units


def apply_ground_results(
    results: dict[str, UnitResult],
    *,
    pdf_bytes: bytes,
    form_pages: list[str],
    no_atoms_pages: list[str],
) -> dict[str, dict]:
    """페이지별 FormSchema dict. no_atoms_pages 는 빈 서식으로 즉시 조립."""
    by_page: dict[str, list[UnitResult]] = {}
    for key, r in results.items():
        pid, _tag = key.split(":", 1)
        by_page.setdefault(pid, []).append(r)

    forms: dict[str, dict] = {}
    with PdfProcessor(pdf_bytes) as proc:
        for pid in form_pages:
            num = page_num(pid)
            if num is None or num > proc.page_count:
                continue
            img = _decode_page(proc, num)
            gray, _color, atoms = derive_atoms(img)
            IH, IW = gray.shape

            if pid in no_atoms_pages:
                built = {"page": {"w": IW, "h": IH}, "elements": []}
                forms[pid] = to_form_schema(built, image_name=f"{pid}.png")
                continue

            box1000 = {j: _atom_box_1000(r, (IH, IW)) for j, r in atoms}
            region_area = {j: r[2] * r[3] for j, r in atoms}

            raw_elements: list[dict] = []
            for r in by_page.get(pid, []):
                data = parse_json_lenient(r.content)[0] if (r.ok and r.content) else None
                els = (data or {}).get("elements") if isinstance(data, dict) else None
                if not isinstance(els, list):
                    continue
                for e in els:
                    if not e.get("box") or len(e["box"]) != 4:
                        continue
                    rb = box1000.get(e.get("region"))
                    if rb is None:
                        continue
                    cl = _clamp_box_to_region(e["box"], rb)
                    if not cl:
                        continue
                    e = dict(e)
                    e["box"] = cl
                    raw_elements.append(e)

            merged = assign_keys(dedup_nested(raw_elements, region_area))
            S = segment(gray)
            elements = place_elements(gray, S, merged)
            built = {"page": {"w": IW, "h": IH}, "elements": elements}
            forms[pid] = to_form_schema(built, image_name=f"{pid}.png")
    return forms


def _decode_page(
    proc: PdfProcessor,
    page_no: int,
):
    png = proc.render_page_png(page_no)
    arr = np.frombuffer(png, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)
