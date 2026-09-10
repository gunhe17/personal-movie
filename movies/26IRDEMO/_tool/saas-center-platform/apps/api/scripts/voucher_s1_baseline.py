#!/usr/bin/env python3
"""S1 image-to-md smoke + baseline ledger (fixture PNG → PDF).

Usage (apps/api):
  uv run python scripts/voucher_s1_baseline.py

Writes:
  app/runtime/voucher_document/document_to_markdown/baselines/fixture-pages.jsonl
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

FIXTURES = ROOT / "tests/unit/runtime/voucher_document/fixtures"
OUT = (
    ROOT
    / "app/runtime/voucher_document/document_to_markdown/baselines/fixture-pages.jsonl"
)
MARKER_RE = re.compile(r"\[\[C\d+\]\]")


def build_pdf(pngs: list[Path]) -> bytes:
    """PNG → 긴 변 1200px JPEG 임베드 PDF."""
    import cv2
    import numpy as np

    doc = fitz.open()
    for p in pngs:
        img = cv2.imdecode(np.frombuffer(p.read_bytes(), np.uint8), cv2.IMREAD_COLOR)
        h, w = img.shape[:2]
        scale = min(1.0, 1200 / max(w, h))
        if scale < 1.0:
            img = cv2.resize(img, (int(w * scale), int(h * scale)))
            h, w = img.shape[:2]
        ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        if not ok:
            raise RuntimeError(f"jpeg encode failed: {p}")
        page = doc.new_page(width=w, height=h)
        page.insert_image(page.rect, stream=buf.tobytes())
    return doc.tobytes()


async def main() -> int:
    from app.modules.llm.credit_balance.plan_config import AIPurpose
    from app.modules.llm.facade.ai_facade import create_ai_facade
    from app.modules.llm.gateway.schemas import AICallContext
    from app.runtime.voucher_document.document_to_markdown import (
        DocumentToMarkdownService,
    )

    pngs = [FIXTURES / n for n in ("p-007.png", "p-011.png", "p-149.png")]
    for p in pngs:
        if not p.exists():
            print(f"missing fixture {p}", file=sys.stderr)
            return 1

    pdf = build_pdf(pngs)
    print(f"pdf bytes={len(pdf)} pages={len(pngs)}")

    gw = create_ai_facade()
    svc = DocumentToMarkdownService(ai_gateway=gw)
    ctx = AICallContext(
        center_id="",
        source_type="voucher_s1_baseline",
        source_id="fixture-pages",
        purpose=AIPurpose.VOUCHER_PDF_TO_MD,
    )
    result = await svc.execute(
        document_bytes=pdf,
        ai_context=ctx,
        concurrency=3,
    )

    leftover = {
        pid: MARKER_RE.findall(md) for pid, md in result.pages.items() if MARKER_RE.search(md)
    }
    row = {
        "pdf": "fixtures/p-007+011+149.png",
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
        "chars": {pid: len(md) for pid, md in sorted(result.pages.items())},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(row, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(row, ensure_ascii=False, indent=2))

    if leftover:
        print("FAIL: markers remain", file=sys.stderr)
        return 2
    if result.chunks_failed or not result.pages:
        print("FAIL: page failures or empty", file=sys.stderr)
        return 3
    if len(result.pages) != 3:
        print("FAIL: expected 3 pages", file=sys.stderr)
        return 4
    print(f"OK → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
