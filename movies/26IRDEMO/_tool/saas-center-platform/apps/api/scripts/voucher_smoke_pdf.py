#!/usr/bin/env python3
"""실 PDF 스모크 — document_to_markdown + document_to_form.

Usage (apps/api):
  uv run python scripts/voucher_smoke_pdf.py \\
    --pdf "/Users/gunhee/Desktop/아동정서발달지원서비스.pdf"
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

MARKER_RE = re.compile(r"\[\[C\d+\]\]")


async def run_markdown(
    gw,
    pdf: bytes,
    out_dir: Path,
) -> dict:
    from app.modules.llm.credit_balance.plan_config import AIPurpose
    from app.modules.llm.gateway.schemas import AICallContext
    from app.runtime.voucher_document.document_to_markdown import (
        DocumentToMarkdownService,
    )

    print("\n=== [1/2] document_to_markdown ===")
    t0 = time.perf_counter()
    svc = DocumentToMarkdownService(ai_gateway=gw)
    ctx = AICallContext(
        center_id="",
        source_type="voucher_smoke",
        source_id="아동정서발달지원서비스",
        purpose=AIPurpose.VOUCHER_PDF_TO_MD,
    )
    result = await svc.execute(
        document_bytes=pdf,
        ai_context=ctx,
        concurrency=3,
    )
    elapsed = time.perf_counter() - t0

    md_path = out_dir / "pages.md"
    pages_sorted = sorted(result.pages.items())
    md_path.write_text(
        "\n\n---\n\n".join(f"<!-- {pid} -->\n{md}" for pid, md in pages_sorted),
        encoding="utf-8",
    )
    leftover = {
        pid: MARKER_RE.findall(md)
        for pid, md in result.pages.items()
        if MARKER_RE.search(md)
    }
    summary = {
        "prompt_version": result.prompt_version,
        "model": result.model,
        "pages": result.total_pages,
        "pages_ok": sorted(result.pages.keys()),
        "pages_failed": [
            {"start": f.start_page, "end": f.end_page, "error": f.error}
            for f in result.failures
        ],
        "markers_left": leftover,
        "cost_usd": result.total_cost_usd,
        "wall_s": round(elapsed, 1),
        "chars": {pid: len(md) for pid, md in pages_sorted},
        "md_path": str(md_path),
    }
    (out_dir / "markdown_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


async def run_form(
    gw,
    pdf: bytes,
    out_dir: Path,
) -> dict:
    from app.modules.llm.credit_balance.plan_config import AIPurpose
    from app.modules.llm.gateway.schemas import AICallContext
    from app.runtime.voucher_document.document_to_form import DocumentToFormService
    from app.runtime.voucher_document.processing_spec import (
        MODEL_FALLBACK,
        MODEL_PRIMARY,
    )

    print("\n=== [2/2] document_to_form ===")
    t0 = time.perf_counter()
    svc = DocumentToFormService(ai_gateway=gw)
    ctx = AICallContext(
        center_id="",
        source_type="voucher_smoke",
        source_id="아동정서발달지원서비스",
        purpose=AIPurpose.FORM_EXTRACT_SCHEMA,
    )
    result = await svc.execute(
        document_bytes=pdf,
        ai_context=ctx,
        detect_model=MODEL_FALLBACK,
        extract_model=MODEL_PRIMARY,
        concurrency=3,
    )
    elapsed = time.perf_counter() - t0

    forms = []
    for fp in result.form_pages:
        schema_path = None
        if fp.schema:
            schema_path = out_dir / f"form_{fp.page}_schema.json"
            schema_path.write_text(
                json.dumps(fp.schema, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        forms.append(
            {
                "page": fp.page,
                "title": fp.title,
                "kind": fp.kind,
                "reason": fp.reason,
                "has_schema": fp.schema is not None,
                "field_count": len((fp.schema or {}).get("fields") or {}),
                "element_count": len((fp.schema or {}).get("elements") or []),
                "schema_path": str(schema_path) if schema_path else None,
            }
        )

    summary = {
        "detect_model": result.detect_model,
        "extract_model": result.extract_model,
        "pages_judged": result.pages_judged,
        "form_pages": forms,
        "failures": [{"page": f.page, "error": f.error} for f in result.failures],
        "cost_usd": result.cost_usd,
        "wall_s": round(elapsed, 1),
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens,
    }
    (out_dir / "form_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pdf",
        type=Path,
        default=Path("/Users/gunhee/Desktop/아동정서발달지원서비스.pdf"),
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "tmp/voucher_smoke_아동정서",
    )
    parser.add_argument(
        "--only",
        choices=("all", "markdown", "form"),
        default="all",
    )
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"missing pdf: {args.pdf}", file=sys.stderr)
        return 1

    pdf = args.pdf.read_bytes()
    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"pdf={args.pdf} bytes={len(pdf)} out={out_dir}")

    from app.modules.llm.facade.ai_facade import create_ai_facade

    gw = create_ai_facade()
    md_sum = form_sum = None
    if args.only in ("all", "markdown"):
        md_sum = await run_markdown(gw, pdf, out_dir)
    if args.only in ("all", "form"):
        form_sum = await run_form(gw, pdf, out_dir)

    combined = {
        "pdf": str(args.pdf),
        "markdown": md_sum,
        "form": form_sum,
        "total_cost_usd": round(
            (md_sum or {}).get("cost_usd", 0) + (form_sum or {}).get("cost_usd", 0),
            4,
        ),
    }
    (out_dir / "summary.json").write_text(
        json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nTOTAL cost≈${combined['total_cost_usd']} → {out_dir / 'summary.json'}")

    ok = True
    if md_sum is not None:
        if md_sum.get("markers_left") or md_sum.get("pages_failed") or not md_sum.get(
            "pages_ok"
        ):
            ok = False
    if form_sum is not None and form_sum.get("failures"):
        # schema 실패만 있으면 soft — 판정은 됐을 수 있음
        print("WARN: form failures present", file=sys.stderr)
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
