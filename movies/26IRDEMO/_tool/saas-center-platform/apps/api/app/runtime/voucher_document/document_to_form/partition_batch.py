"""s3_partition_batch — 대구획 분리(LLM 1콜/폼페이지) 배치 스테이지.

CV(segment→atoms)는 LLM 없이 결정론이라 build/apply 양쪽에서 독립적으로
재계산한다(`ground_focus.derive_atoms`) — 저장 안 함. atoms 가 0개인 페이지는
LLM 호출 자체가 무의미해 unit 을 안 만들고 `no_atoms_pages`로 분리 보고한다
(호출자가 그 페이지들을 즉시 no_atoms 처리 — atoms 없는 페이지는 LLM 콜 없이 빈 서식 확정).
"""
from __future__ import annotations

import cv2
import numpy as np

from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.common.page_markdown import page_num
from app.runtime.voucher_document.common.pdf_processor import PdfProcessor
from app.runtime.voucher_document.processing_spec import MODEL_PRIMARY

from .extract import FORM_GROUND_TEMPERATURE
from .ground_focus import (
    PARTITION_MAX_TOKENS,
    PARTITION_REASONING,
    PARTITION_RESPONSE_FORMAT,
    PARTITION_SYS,
    _b64,
    _normalize_groups,
    derive_atoms,
)
from .pipeline import som_mark


def build_partition_units(
    *,
    pdf_bytes: bytes,
    form_pages: list[str],
    model: str = MODEL_PRIMARY,
) -> tuple[list[BatchUnit], list[str]]:
    """(units, no_atoms_pages). no_atoms_pages 는 배치 제출 없이 빈 서식으로 즉시 확정."""
    units: list[BatchUnit] = []
    no_atoms_pages: list[str] = []
    with PdfProcessor(pdf_bytes) as proc:
        for pid in form_pages:
            num = page_num(pid)
            if num is None or num > proc.page_count:
                no_atoms_pages.append(pid)
                continue
            png = proc.render_page_png(num)
            arr = np.frombuffer(png, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            _, color, atoms = derive_atoms(img)
            if not atoms:
                no_atoms_pages.append(pid)
                continue
            marked = som_mark(color, atoms)
            units.append(
                BatchUnit(
                    key=pid,
                    model=model,
                    messages=[
                        {"role": "system", "content": PARTITION_SYS},
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"위 서식의 번호 0~{max(0, len(atoms) - 1)}을 규칙대로 구획으로 묶어라.\n[이미지]↓",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{_b64(marked)}"},
                                },
                            ],
                        },
                    ],
                    max_tokens=PARTITION_MAX_TOKENS,
                    temperature=FORM_GROUND_TEMPERATURE,
                    reasoning=PARTITION_REASONING,
                    response_format=PARTITION_RESPONSE_FORMAT,
                )
            )
    return units, no_atoms_pages


def apply_partition_results(
    results: dict[str, UnitResult],
    *,
    pdf_bytes: bytes,
) -> dict[str, list[list[int]] | None]:
    """페이지별 groups. 파싱 실패/빈 결과는 None(호출자가 page 모드로 그라운딩).

    n_atoms 정규화를 위해 atoms 를 다시 유도한다(build 시점과 동일 재계산, LLM 아님)."""
    from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient

    partitions: dict[str, list[list[int]] | None] = {}
    with PdfProcessor(pdf_bytes) as proc:
        for pid, r in results.items():
            if not r.ok or not (r.content or "").strip():
                partitions[pid] = None
                continue
            data, _ = parse_json_lenient(r.content)
            if not isinstance(data, dict) or not isinstance(data.get("groups"), list):
                partitions[pid] = None
                continue
            num = page_num(pid)
            n_atoms = 0
            if num is not None and num <= proc.page_count:
                png = proc.render_page_png(num)
                arr = np.frombuffer(png, dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                _, _, atoms = derive_atoms(img)
                n_atoms = len(atoms)
            partitions[pid] = _normalize_groups(data["groups"], n_atoms)
    return partitions
