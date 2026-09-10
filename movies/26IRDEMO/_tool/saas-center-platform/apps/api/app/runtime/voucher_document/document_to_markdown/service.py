"""DocumentToMarkdownService — document → page markdown (lab image-to-md).

PDF ─[render]→ PNG ─[CV whiteout]→ whole_page LLM (+ nested crops) → pages md.
실행은 runner(`run_stage`)가 소유 — 여기는 unit 빌드와 결과 조립만.
"""
from __future__ import annotations

import base64

from app.core.logger import get_logger
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.common.pdf_processor import PdfProcessor
from app.runtime.voucher_document.common.page_markdown import page_id, page_num
from app.runtime.voucher_document.processing_spec import (
    MODEL_PRIMARY,
    S1_MAX_TOKENS,
    S1_REASONING,
    S1_WHOLE_SYS,
    TEMPERATURE,
)

from . import image_pipeline as ip
from .schemas import ChunkFailure, DocumentToMarkdownResult

logger = get_logger(__name__)

PROMPT_VERSION = "image-to-md-v1"
DEFAULT_MODEL = MODEL_PRIMARY


class DocumentToMarkdownService:
    @staticmethod
    def build_units(
        *,
        document_bytes: bytes,
        page_range: tuple[int, int] | None = None,
        model: str = DEFAULT_MODEL,
        max_tokens: int = S1_MAX_TOKENS,
        temperature: float = TEMPERATURE,
    ) -> list[BatchUnit]:
        """CV 전처리(렌더+whiteout)만 — LLM 호출 없음. batch/실시간 공용 unit 빌더.

        키 규약: 본문=`p-NNN`, 중첩표=`p-NNN:[[Ci]]`(콜론 앞이 페이지, 뒤가 marker) —
        `assemble()`이 이 규약으로 페이지별 결과를 재조립한다(별도 매핑 저장 불요).
        """
        units: list[BatchUnit] = []
        with PdfProcessor(document_bytes) as proc:
            start, end = _resolve_range(proc.page_count, page_range)
            for page_no in range(start, end + 1):
                pid = page_id(page_no)
                img = ip.decode_png(proc.render_page_png(page_no))
                clean, markers, unmatched = ip.whiteout_nested(img)
                if unmatched:
                    logger.warning(
                        "document_to_markdown %s: unmatched nested tables=%d (left in page)",
                        pid,
                        len(unmatched),
                    )
                units.append(
                    _image_unit(pid, clean, model=model, max_tokens=max_tokens, temperature=temperature)
                )
                for marker, bbox in markers.items():
                    crop = ip.crop_bbox(img, bbox)
                    units.append(
                        _image_unit(
                            f"{pid}:{marker}", crop, model=model, max_tokens=max_tokens, temperature=temperature
                        )
                    )
        return units

    @staticmethod
    def assemble(
        results: dict[str, UnitResult],
        *,
        model: str = DEFAULT_MODEL,
    ) -> DocumentToMarkdownResult:
        """`build_units()`가 만든 key 규약으로 페이지별 결과를 병합."""
        result = DocumentToMarkdownResult(model=model, prompt_version=PROMPT_VERSION)
        bodies: dict[str, UnitResult] = {}
        nested_by_page: dict[str, dict[str, UnitResult]] = {}
        for key, r in results.items():
            if ":" in key:
                pid, marker = key.split(":", 1)
                nested_by_page.setdefault(pid, {})[marker] = r
            else:
                bodies[key] = r
        result.total_pages = len(bodies)

        for pid in sorted(bodies):
            body_result = bodies[pid]
            page_no = page_num(pid) or 0
            if not body_result.ok or not (body_result.content or "").strip():
                result.chunks_failed += 1
                result.failures.append(
                    ChunkFailure(
                        start_page=page_no, end_page=page_no,
                        error=body_result.error or "empty body", attempts=1,
                    )
                )
                continue

            body = ip.strip_outer_fence(body_result.content)
            _accumulate_result_stats(result, body_result)

            nested = nested_by_page.get(pid, {})
            replacements: dict[str, str] = {}
            nested_failed = False
            for marker, r in nested.items():
                _accumulate_result_stats(result, r)
                if not r.ok or not (r.content or "").strip():
                    result.chunks_failed += 1
                    result.failures.append(
                        ChunkFailure(
                            start_page=page_no, end_page=page_no,
                            error=r.error or f"empty nested {marker}", attempts=1,
                        )
                    )
                    nested_failed = True
                    break
                replacements[marker] = ip.strip_outer_fence(r.content)
            if nested_failed:
                continue

            if nested:
                ip.assert_markers_once(body, dict.fromkeys(nested))
                body = ip.substitute_markers(body, replacements)

            result.chunks_processed += 1
            result.pages[pid] = body

        return result


def _image_unit(
    key: str,
    img,
    *,
    model: str,
    max_tokens: int,
    temperature: float,
) -> BatchUnit:
    b64 = base64.b64encode(ip.encode_png(img)).decode()
    messages = [
        {"role": "system", "content": S1_WHOLE_SYS},
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
            ],
        },
    ]
    return BatchUnit(
        key=key,
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        reasoning=S1_REASONING,
        # 전사는 산문/HTML이 정답 — 미지정이면 chat_json이 json_object를 강제해 전사문이
        # [{"content":…}] JSON으로 감싸져 md 슬롯이 오염된다(2026-08-31 1쪽 실측).
        response_format={"type": "text"},
    )


def _resolve_range(
    total_pages: int,
    page_range: tuple[int, int] | None,
) -> tuple[int, int]:
    if page_range is None:
        return (1, total_pages)
    start = max(1, page_range[0])
    end = min(total_pages, page_range[1])
    if start > end:
        raise ValueError(
            f"invalid page_range {page_range} for PDF with {total_pages} pages"
        )
    return start, end


def _accumulate_result_stats(
    result: DocumentToMarkdownResult,
    r: UnitResult,
) -> None:
    result.total_input_tokens += r.input_tokens
    result.total_output_tokens += r.output_tokens
    result.total_cost_usd += r.cost_usd
    result.total_latency_ms += r.latency_ms
