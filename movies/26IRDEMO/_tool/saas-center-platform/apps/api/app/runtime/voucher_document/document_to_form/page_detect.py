"""S3 — 서식 페이지 판정 (페이지 이미지 1장 → is_form 이진, 페이지당 1 unit).

FormSchema 추출은 partition_batch/ground_batch 가 담당(실행은 runner `run_stage`).
lab 검증 구성: 이진 판정은 flash 로 충분/빠름 — temperature 1.0,
maxOutputTokens 1024, 퓨샷 없음. 프롬프트는 processing_spec verbatim.
"""
from __future__ import annotations

import base64

from app.infrastructure.llm.openrouter.chat_json import parse_json_lenient
from app.runtime.voucher_document.batch_unit import BatchUnit, UnitResult
from app.runtime.voucher_document.common.page_markdown import page_id
from app.runtime.voucher_document.common.pdf_processor import (
    PdfProcessor,
)
from app.runtime.voucher_document.processing_spec import (
    FORM_KINDS,
    FORM_SCOPES,
    MODEL_FALLBACK,
    S3_MAX_TOKENS,
    S3_SYSTEM,
    S3_TASK,
    TEMPERATURE,
)

from .schemas import FormDetectionResult, FormPage, FormPageFailure

# 판정 출력 강제 스키마 — is_form 이진 + 라벨. Gemini 배치 경로도 mime/schema로 JSON 고정.
_DETECT_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "form_judgement",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "is_form": {"type": "boolean"},
                "title": {"type": ["string", "null"]},
                "kind": {"type": ["string", "null"]},
                "scope": {"type": ["string", "null"]},
                "voucher_name": {"type": ["string", "null"]},
                "reason": {"type": ["string", "null"]},
            },
            # Gemini 엔진: additionalProperties:false 시 전 property required(extract.py 주석).
            "required": ["is_form", "title", "kind", "scope", "voucher_name", "reason"],
            "additionalProperties": False,
        },
    },
}


class FormPageDetectService:
    """PDF 전 페이지 → is_form=true 페이지 목록 (스키마 추출 없음)."""

    @staticmethod
    def build_units(
        *,
        document_bytes: bytes,
        model: str = MODEL_FALLBACK,
    ) -> list[BatchUnit]:
        """CV 없음 — 페이지 렌더만(순수 PDF I/O). batch/실시간 공용 unit 빌더. key=page_id."""
        units: list[BatchUnit] = []
        with PdfProcessor(document_bytes) as proc:
            for page_no in range(1, proc.page_count + 1):
                png = proc.render_page_png(page_no)
                b64 = base64.b64encode(png).decode()
                units.append(
                    BatchUnit(
                        key=page_id(page_no),
                        model=model,
                        messages=[
                            {"role": "system", "content": S3_SYSTEM},
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": f"data:image/png;base64,{b64}"},
                                    },
                                    {"type": "text", "text": S3_TASK},
                                ],
                            },
                        ],
                        max_tokens=S3_MAX_TOKENS,
                        temperature=TEMPERATURE,
                        response_format=_DETECT_RESPONSE_FORMAT,
                    )
                )
        return units

    @staticmethod
    def assemble(
        results: dict[str, UnitResult],
        *,
        model: str = MODEL_FALLBACK,
    ) -> FormDetectionResult:
        result = FormDetectionResult(model=model, pages_judged=len(results))
        for pid in sorted(results):
            r = results[pid]
            result.cost_usd += r.cost_usd
            result.latency_ms += r.latency_ms
            result.input_tokens += r.input_tokens
            result.output_tokens += r.output_tokens

            data = parse_json_lenient(r.content)[0] if (r.ok and r.content) else None
            if not isinstance(data, dict) or not isinstance(data.get("is_form"), bool):
                result.failures.append(
                    FormPageFailure(page=pid, error=r.error or "판정 JSON 파싱 실패")
                )
                continue
            if data.get("is_form") is True:
                result.form_pages.append(
                    FormPage(
                        page=pid,
                        title=str(data.get("title") or ""),
                        kind=_clamp_kind(data.get("kind")),
                        scope=_clamp_scope(data.get("scope")),
                        voucher_name=str(data.get("voucher_name") or "").strip(),
                        reason=str(data.get("reason") or ""),
                    )
                )
        return result


def _clamp_scope(scope) -> str:
    """LLM scope → FORM_SCOPES 로 클램프. 모르면 unknown(사람이 정한다)."""
    s = str(scope or "").strip().lower()
    return s if s in FORM_SCOPES else "unknown"


def _clamp_kind(kind) -> str:
    """LLM kind → FORM_KINDS 어휘로 클램프 (모르면 '기타')."""
    s = str(kind or "").strip()
    if not s:
        return ""
    return s if s in FORM_KINDS else "기타"
