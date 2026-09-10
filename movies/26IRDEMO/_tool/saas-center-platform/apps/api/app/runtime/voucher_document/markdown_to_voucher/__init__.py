"""markdown → 바우처별 구조화 데이터 변환 모듈 (분리 + 필드 추출).

병합된 page-level markdown (`<!-- p-NNN -->` / `<!-- ═══ p-NNN ═══ -->` 마커) 과
구간 페이지 이미지를 입력으로 받아, 개별 바우처(세부사업)를 분리하고(텍스트 경로는
document_to_list, 스캔 경로는 S2a) 바우처별로 팩 v4.1 21축에 원문 표기 그대로
캡처한다. 정본은 fields(값 + page·quote), record 는 map_capture 의 환산 결과.

정본 계약: processing_spec FIELD_PACK · FIELD_EXTRACT_SYSTEM_*.

엔트리 (실행은 runner `run_stage`가 소유):
    S2a = build_separation_unit + parse_separation_result
    field = build_field_units + assemble_field_results (팩 v4.1 21축·9그룹) · repair = build/apply_repair_*
    DM  = build_dm_unit + parse_dm_result
"""
from .field_extract import assemble_field_results, build_field_units, normalize_fields
from .normalize import map_capture
from .schemas import CommonSpan, VoucherSpan
from .meta import build_dm_unit, normalize_meta, parse_dm_result
from .quote_snapping import snap_meta_quotes, snap_voucher_quotes
from .separation import build_separation_unit, parse_separation_result
from app.runtime.voucher_document.common.page_markdown import (
    full_markdown,
    load_pages_from_markdown,
    page_id,
    page_num,
    pages_markdown,
)

__all__ = [
    "VoucherSpan",
    "CommonSpan",
    "build_separation_unit",
    "parse_separation_result",
    "map_capture",
    "build_field_units",
    "assemble_field_results",
    "normalize_fields",
    "build_dm_unit",
    "parse_dm_result",
    "normalize_meta",
    "snap_voucher_quotes",
    "snap_meta_quotes",
    "load_pages_from_markdown",
    "full_markdown",
    "pages_markdown",
    "page_id",
    "page_num",
]
