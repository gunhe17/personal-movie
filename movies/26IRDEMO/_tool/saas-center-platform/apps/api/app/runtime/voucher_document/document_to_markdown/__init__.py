"""document → page-level markdown 변환 (S1).

lab image-to-md: CV whiteout + whole_page. 현재 입력은 PDF.

엔트리 (실행은 runner `run_stage`가 소유):
    DocumentToMarkdownService.build_units(document_bytes=...) → list[BatchUnit]
    DocumentToMarkdownService.assemble(results) → DocumentToMarkdownResult
"""
from app.runtime.voucher_document.processing_spec import (
    S1_CUTOFF_SECONDS,
    S1_MAX_TOKENS,
    S1_REASONING,
    S1_WHOLE_SYS,
)

from .schemas import (
    ChunkFailure,
    DocumentToMarkdownResult,
)
from .service import (
    DEFAULT_MODEL,
    PROMPT_VERSION,
    DocumentToMarkdownService,
)

__all__ = [
    "DocumentToMarkdownService",
    "DocumentToMarkdownResult",
    "ChunkFailure",
    "PROMPT_VERSION",
    "DEFAULT_MODEL",
    "S1_MAX_TOKENS",
    "S1_CUTOFF_SECONDS",
    "S1_REASONING",
    "S1_WHOLE_SYS",
]
