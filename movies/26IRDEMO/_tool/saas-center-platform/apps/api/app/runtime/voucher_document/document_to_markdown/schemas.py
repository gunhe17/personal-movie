"""PDF → Markdown 변환 결과 dataclass."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ChunkFailure:
    start_page: int
    end_page: int
    error: str
    attempts: int


@dataclass
class DocumentToMarkdownResult:
    pages: dict[str, str] = field(default_factory=dict)  # 성공 페이지 통합
    total_pages: int = 0
    chunks_processed: int = 0
    chunks_failed: int = 0
    total_cost_usd: float = 0.0
    total_latency_ms: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    failures: list[ChunkFailure] = field(default_factory=list)
    model: str = ""
    prompt_version: str = ""

    def to_markdown(
        self,
        *,
        page_markers: bool = True,
        separator: str = "\n\n",
    ) -> str:
        if not self.pages:
            return ""
        sorted_ids = sorted(self.pages.keys())
        if page_markers:
            parts = [f"<!-- {pid} -->\n{self.pages[pid]}" for pid in sorted_ids]
        else:
            parts = [self.pages[pid] for pid in sorted_ids]
        return separator.join(parts)
