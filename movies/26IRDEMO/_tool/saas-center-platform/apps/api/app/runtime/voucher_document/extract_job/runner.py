"""단일 파이프라인 상태 머신 — `advance_batch_stage_if_ready`가 조회/cron 1회당
정확히 이 중 한 함수만 호출한다(다단계 연쇄 금지, voucher-extraction-pipeline 계획).

stage 시퀀스 — 2단계 + 확정 게이트:
    1단계(구조): route → list → s3_detect → review(사용자 확정 대기 — 실행 없음)
    2단계(내용): tx → field → repair → dm → finalize   ← confirm-layout 이 깨운다
    (스캔 PDF: route → s1 → s2a → s3_detect → review → …)
"review" 는 STAGE_FUNCS 에 없다 — executor 가 이 값을 보면 status=review 로 마킹하고 멈춘다.
field 는 사용자가 확정한 spans 만 돈다. 서식은 확정본 form_units(구간)가 정본이고,
s3_detect 산출 form_pages 는 화면의 제안 재료다.

각 스테이지의 Gemini 호출은 `run_stage` 로 실행된다 — realtime(기본, OpenRouter flex −50%)
또는 batch(VOUCHER_GEMINI_MODE=batch: Gemini Batch API 직결, 단가 50%). repair(sonnet-5)는
gemini 가 아니라 어느 모드에서든 realtime·flex=False.

s3_detect는 서식 페이지 감지+PNG 적재까지만 — FormSchema 추출(partition/ground)은 voucher가
하지 않는다(독립 `DocumentToFormService` 온디맨드 소관).

`progress.data` 스키마(스테이지 간 인계 — 전부 JSON 호환, 캐스팅 없이 그대로):
    md_storage_path   S1 완료 후. 이후 스테이지가 이 경로로 병합 md 재다운로드.
    s2a_attempt       "primary"|"fallback" — S2a 분리 모델 재시도 상태.
    spans             S2a 완료 후 — VoucherSpan dataclass를 그대로 asdict.
    commons           S2a 완료 후 — [{label,span}].
    vouchers          S2b 완료 후(list[dict]) — dense가 금액/서비스/제공인력 덮어씀.
    meta              DM 완료 후(dict).
    form_pages        s3_detect 완료 후 — [{page,title,kind,reason}].
"""
from __future__ import annotations

from dataclasses import asdict

import fitz

from app.core.exceptions import InvalidOperationException
from app.core.logger import get_logger
from app.infrastructure.storage.common.base import StorageClient
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.llm.credit_balance.plan_config import AIPurpose
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.runtime.voucher_document.batch_unit import BatchUnit, run_stage
from app.runtime.voucher_document.document_to_form.page_detect import FormPageDetectService
from app.runtime.voucher_document.document_to_list import (
    apply_arbiter_results,
    assemble_split,
    build_arbiter_units,
    build_split_units,
    classify_pdf_bytes,
    complement,
    reconcile_with_toc,
    scope_warning,
    text_pages_markdown,
    title_candidates,
)
from app.runtime.voucher_document.document_to_form.schemas import FormPage
from app.runtime.voucher_document.document_to_markdown.service import DocumentToMarkdownService
from app.runtime.voucher_document.markdown_to_voucher.field_extract import (
    assemble_field_results,
    build_field_units,
    overflow_pages,
    span_ints,
)
from app.runtime.voucher_document.markdown_to_voucher.normalize import map_capture
from app.runtime.voucher_document.markdown_to_voucher.review_flags import flag_fields
from app.runtime.voucher_document.markdown_to_voucher.repair import (
    apply_repair_results,
    build_repair_units,
)
from app.runtime.voucher_document.markdown_to_voucher.meta import (
    build_dm_unit,
    intersect_meta,
    parse_dm_result,
)
from app.runtime.voucher_document.markdown_to_voucher.quote_snapping import (
    snap_meta_quotes,
    snap_voucher_quotes,
)
from app.runtime.voucher_document.markdown_to_voucher.schemas import VoucherSpan
from app.runtime.voucher_document.markdown_to_voucher.verification import page_texts, verify_vouchers
from app.runtime.voucher_document.markdown_to_voucher.separation import (
    build_separation_unit,
    parse_separation_result,
)
from app.runtime.voucher_document.common.page_markdown import (
    full_markdown,
    load_pages_from_markdown,
    page_id,
    page_num,
)
from app.runtime.voucher_document.processing_spec import (
    FIELD_PACK,
    MODEL_FALLBACK,
    MODEL_PRIMARY,
)

from .save_form_pages import SaveFormPagesService
from .save_markdown import SaveVoucherMarkdownService

logger = get_logger(__name__)

# 한 번의 전진이 요청 수명(브라우저 30초 타임아웃) 안에 끝나도록 자르는 크기.
# 죽어도 여기까지는 progress.data 에 커밋돼 다음 전진이 이어받는다.
# 실측(2026-08-31): 바우처 3건(27유닛)이 35초 — 브라우저 axios 타임아웃 30초를 넘겨
# 27건을 다 호출하고도 커밋 전에 요청이 죽었다. 한 전진은 넉넉히 그 안에 들어와야 한다.
FIELD_CHUNK = 1      # 바우처 1건 = 9 유닛 (~12초)
S3_CHUNK = 15        # 페이지 15쪽


async def _resolve_pdf_doc(
    gdoc_facade: GlobalDocumentFacade,
    extraction,
):
    """원본 PDF global_document 해소 — 다운로드 없음(이름만 필요할 때)."""
    ids = list(extraction.source_document_ids or [])
    docs = await gdoc_facade.get_many_including_deleted(ids) if ids else []
    pdf_doc = next((d for d in docs if (d.file_type or "").lower() == "pdf"), None)
    if pdf_doc is None:
        raise InvalidOperationException("가공하려면 PDF 형식의 원본 파일이 필요합니다.")
    return pdf_doc


async def _resolve_pdf(
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
) -> tuple[bytes, str]:
    """(pdf_bytes, base_name) — 매 스테이지가 재다운로드(캐시 안 함, S3 계열 다단계 공용)."""
    pdf_doc = await _resolve_pdf_doc(gdoc_facade, extraction)
    return await storage.download_file(pdf_doc.storage_path), pdf_doc.name


async def _load_pages(
    storage: StorageClient,
    data: dict,
) -> dict[int, str]:
    merged_md = (await storage.download_file(data["md_storage_path"])).decode("utf-8")
    return load_pages_from_markdown(merged_md)


def _ctx(
    extraction,
    purpose: str,
) -> AICallContext:
    return AICallContext(
        center_id="",
        source_type="voucher_extraction",
        source_id=extraction.id,
        purpose=purpose,
    )


async def advance_route(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    """첫 스테이지(결정론·LLM 없음) — 텍스트 PDF 는 하이브리드 경로(텍스트층 md → list),
    스캔 PDF 는 기존 S1 전사 경로로 자동 폴백(이식 결정 ④). lab E18 라우팅 실측."""
    data = progress.get("data") or {}
    pdf_bytes, base_name = await _resolve_pdf(gdoc_facade, storage, extraction)
    pdf_type, n_pages = classify_pdf_bytes(pdf_bytes)
    data["pdf_type"], data["n_pages"] = pdf_type, n_pages
    if pdf_type != "text_based":
        data["route"] = "scan_s1"
        return {"stage": "s1", "data": data}
    pages_md, table_pages = text_pages_markdown(pdf_bytes)
    merged_md = "\n\n".join(f"<!-- {page_id(i)} -->\n{pages_md.get(i, '')}" for i in range(1, n_pages + 1))
    saved = await SaveVoucherMarkdownService(
        gdoc_facade=gdoc_facade, voucher_facade=voucher_facade
    ).execute(extraction=extraction, merged_markdown=merged_md, name=base_name)
    data["md_storage_path"] = saved.storage_path
    data["route"] = "text"
    data["table_pages"] = sorted(table_pages)
    return {"stage": "list", "data": data}


async def advance_list(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    """목록 추출(텍스트 경로) — 폰트 후보 → K=2 판정 합집합 → 목차 대사 → (목차 부재 분쟁만 판정자)
    → 공용 여집합. s2a 대체 (lab E20: F1 0.997 · 누락 0)."""
    data = progress.get("data") or {}
    pdf_bytes, _ = await _resolve_pdf(gdoc_facade, storage, extraction)
    n_pages = int(data.get("n_pages") or 0)
    cands = title_candidates(pdf_bytes)
    ctx = _ctx(extraction, AIPurpose.VOUCHER_MD_TO_JSON)
    results = await run_stage(build_split_units(cands), ai_facade=ai_facade, ai_context=ctx) if cands else {}
    vouchers, diff = assemble_split(results, n_pages)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        vouchers, report = reconcile_with_toc(doc, vouchers, n_pages)
        if report["mode"] == "목차 없음" and diff:
            report["mode"] = f"목차 없음 — 분쟁 {len(diff)}건 판정"
            aunits = build_arbiter_units(doc, vouchers, diff)
            if aunits:
                ares = await run_stage(aunits, ai_facade=ai_facade, ai_context=ctx)
                vouchers, logs = apply_arbiter_results(vouchers, ares)
                report["교정"].extend(logs)
    finally:
        doc.close()
    data["toc_report"] = report
    data["split_diff"] = diff
    if not vouchers:
        data["spans"], data["commons"], data["vouchers"] = [], [], []
        return {"stage": "s3_detect", "data": data}      # 영역 0건도 사용자 확정(수동 추가)으로
    data["scope_warning"] = scope_warning(n_pages, vouchers)
    if data["scope_warning"]:
        logger.warning("extract: extraction=%s [list] %s", extraction.id, data["scope_warning"])
    data["spans"] = [
        asdict(VoucherSpan(
            no=str(v.get("no") or ""), name=v["name"], code=v.get("code"),
            start_page=page_id(v["start_page"]), end_page=page_id(v["end_page"]),
            rationale=" ".join(k for k in ("toc_inserted", "arbitrated") if v.get(k)),
        ))
        for v in vouchers
    ]
    data["commons"] = [{"label": "여집합", "span": [page_id(c["span"][0]), page_id(c["span"][1])]}
                       for c in complement(n_pages, vouchers)]
    return {"stage": "s3_detect", "data": data}


async def advance_tx(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    """넘친 표 페이지 전사 — GEM(S) = {p∈S : T(p)} − IMG(S). 이미지 예산(12장)에 못 든 표 페이지만
    S1 whole-page 전사로 텍스트 슬롯을 교체(비결정성은 여기 한정). 실패 페이지는 텍스트층 유지."""
    data = progress.get("data") or {}
    spans = data.get("spans") or []
    table_pages = set(data["table_pages"]) if data.get("table_pages") is not None else None
    gem = overflow_pages(spans, table_pages)
    data["transcribed_pages"] = []
    if not gem:
        return {"stage": "field", "data": data}
    pdf_bytes, base_name = await _resolve_pdf(gdoc_facade, storage, extraction)
    units = [u for p in gem for u in DocumentToMarkdownService.build_units(document_bytes=pdf_bytes, page_range=(p, p), model=MODEL_PRIMARY)]
    results = await run_stage(
        units, ai_facade=ai_facade, ai_context=_ctx(extraction, AIPurpose.VOUCHER_PDF_TO_MD),
    )
    tx = DocumentToMarkdownService.assemble(results, model=MODEL_PRIMARY)
    pages = await _load_pages(storage, data)
    done = []
    for pid, md in tx.pages.items():
        p = page_num(pid) or 0
        if p in gem and md.strip():
            pages[p] = md
            done.append(p)
    if done:
        merged_md = "\n\n".join(f"<!-- {page_id(i)} -->\n{pages.get(i, '')}" for i in range(1, (data.get('n_pages') or max(pages)) + 1))
        saved = await SaveVoucherMarkdownService(
            gdoc_facade=gdoc_facade, voucher_facade=voucher_facade
        ).execute(extraction=extraction, merged_markdown=merged_md, name=base_name)
        data["md_storage_path"] = saved.storage_path
    data["transcribed_pages"] = sorted(done)
    logger.info("extract: extraction=%s [tx] 넘친 표 페이지 %d → 전사 %d (실패 %d, 텍스트층 유지)",
                extraction.id, len(gem), len(done), len(gem) - len(done))
    return {"stage": "field", "data": data}


async def advance_s1(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    data = progress.get("data") or {}

    async def _build():
        pdf_bytes, _ = await _resolve_pdf(gdoc_facade, storage, extraction)
        units = DocumentToMarkdownService.build_units(document_bytes=pdf_bytes, model=MODEL_PRIMARY)
        if not units:
            raise InvalidOperationException("PDF에 페이지가 없습니다.")
        return units

    results = await run_stage(
        await _build(), ai_facade=ai_facade,
        ai_context=_ctx(extraction, AIPurpose.VOUCHER_PDF_TO_MD),
    )

    result = DocumentToMarkdownService.assemble(results, model=MODEL_PRIMARY)
    if not result.pages:
        first_error = result.failures[0].error if result.failures else "unknown"
        raise InvalidOperationException(f"PDF→MD 변환이 전 페이지 실패했습니다: {first_error}")
    merged_md = result.to_markdown(page_markers=True)

    base_name = (await _resolve_pdf_doc(gdoc_facade, extraction)).name
    saved = await SaveVoucherMarkdownService(
        gdoc_facade=gdoc_facade, voucher_facade=voucher_facade
    ).execute(extraction=extraction, merged_markdown=merged_md, name=base_name)

    data["md_storage_path"] = saved.storage_path
    return {"stage": "s2a", "data": data}


async def advance_s2a(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    """바우처 분리 — 주 모델 0건이면 폴백 모델로 1회 재시도(둘 다 이 stage 안에서 완결).

    voucher_facade/gdoc_facade는 이 스테이지에 불필요하지만 `STAGE_FUNCS`
    디스패처가 전 스테이지에 동일 kwargs를 넘기기 위해 시그니처에 남긴다.
    """
    data = progress.get("data") or {}
    attempt = data.get("s2a_attempt", "primary")
    model = MODEL_PRIMARY if attempt == "primary" else MODEL_FALLBACK
    pages = await _load_pages(storage, data)
    full_doc = full_markdown(pages)

    async def _build():
        return [build_separation_unit(model=model, full_doc=full_doc)]

    results = await run_stage(
        await _build(), ai_facade=ai_facade,
        ai_context=_ctx(extraction, AIPurpose.VOUCHER_MD_TO_JSON),
    )

    result = results["separate"]
    spans, commons = parse_separation_result(result)

    if not spans and attempt == "primary" and MODEL_FALLBACK != MODEL_PRIMARY:
        logger.warning("extract: extraction=%s [S2a] 분리 0개 → fallback 재분리", extraction.id)
        data["s2a_attempt"] = "fallback"
        return {"stage": "s2a", "data": data}

    if not spans:
        if not result.ok:
            raise InvalidOperationException(f"바우처 분리 호출이 실패했습니다: {result.error}")
        # 분리 0 + 정상 응답 = 바우처가 없는 문서 — 영역 확정(수동 추가)으로 넘긴다
        data["spans"] = []
        data["commons"] = []
        return {"stage": "s3_detect", "data": data}

    data["spans"] = [asdict(s) for s in spans]
    data["commons"] = [{"label": c.label, "span": [c.start_page, c.end_page]} for c in commons]
    return {"stage": "s3_detect", "data": data}


async def advance_field(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    """필드 추출 — 바우처당 9그룹(팩 v4.1 21축, ≤캡 구간 이미지 전용·초과분 하이브리드).

    **청크 전진**: 한 번에 FIELD_CHUNK 바우처만 하고 stage 를 field 로 유지한 채 돌려준다.
    25바우처를 한 호출에 몰면 수 분이 걸려, 그 사이 요청이 끊기면(브라우저 30초 타임아웃·
    프로세스 재시작) LLM 225건을 다 쓰고도 결과가 통째로 버려졌다(실측 2026-08-31).
    청크마다 progress.data 가 커밋되므로 죽어도 그 지점부터 이어간다.

    전멸 가드: 청크가 전부 실패해야 예외, 일부 실패는 extract_error 로 진행."""
    data = progress.get("data") or {}
    spans = data.get("spans") or []
    if not spans:
        return {"stage": "dm", "data": data}

    done = data.get("vouchers") or []

    # 실패분 우선 재시도 — 호출이 죽어 fields 가 빈 바우처를 그 자리에 다시 채운다.
    # repair 스테이지는 verify 등급이 나쁜 '셀'만 보므로 fields=None 은 손도 안 댄다.
    # 재개(resume)·재투입이 곧 재시도가 되게, 남은 바우처보다 먼저 처리한다.
    retry_at = [i for i, v in enumerate(done) if v.get("extract_error")]
    if retry_at:
        slots = retry_at[:FIELD_CHUNK]
        chunk = [spans[i] for i in slots]
    else:
        slots = []
        todo = spans[len(done):]
        if not todo:
            return {"stage": "repair", "data": data}
        chunk = todo[:FIELD_CHUNK]

    pdf_bytes, _ = await _resolve_pdf(gdoc_facade, storage, extraction)
    pages = await _load_pages(storage, data)
    table_pages = set(data["table_pages"]) if data.get("table_pages") is not None else None

    async def _build():
        return build_field_units(pdf_bytes=pdf_bytes, pages=pages, spans=chunk, table_pages=table_pages)

    results = await run_stage(
        await _build(), ai_facade=ai_facade,
        ai_context=_ctx(extraction, AIPurpose.VOUCHER_MD_TO_JSON),
    )
    extracted, failures = assemble_field_results(results, chunk)
    # 전멸 가드는 **추출 전체** 기준 — 첫 청크부터 전부 실패면 설정·키 문제라 세우고,
    # 이미 성공한 바우처가 있으면 그 청크만 extract_error 로 두고 계속한다(한 건 때문에
    # 나머지 24건이 막히지 않게).
    if not extracted and not done:
        error = failures[0][1] if failures else "unknown"
        raise InvalidOperationException(
            f"바우처 {len(chunk)}건의 필드 추출이 전부 실패했습니다: {error}"
        )
    for i, s in enumerate(chunk):
        lo, hi = span_ints((s["start_page"], s["end_page"]))
        row = {
            "no": s.get("no") or "", "name": s["name"], "code": s.get("code"),
            "span": [lo, hi], "fields": extracted.get(i), "extract_error": i not in extracted,
        }
        if slots:
            done[slots[i]] = row      # 실패분 자리 교체
        else:
            done.append(row)
    data["vouchers"] = done
    logger.info("extract: extraction=%s [field] %d/%d 바우처 (%s %d건, 성공 %d)",
                extraction.id, len(done), len(spans),
                "재시도" if slots else "신규", len(chunk), len(extracted))
    # 남은 바우처가 있거나, 재시도로도 못 채운 실패분이 줄어드는 중이면 같은 단계 유지
    still_failed = sum(1 for v in done if v.get("extract_error"))
    if len(done) < len(spans) or (slots and len(extracted) > 0 and still_failed):
        return {"stage": "field", "data": data}
    if still_failed:
        logger.warning("extract: extraction=%s [field] 추출 실패 %d건 — 빈 채로 진행",
                       extraction.id, still_failed)   # 같은 단계 유지 — 다음 전진이 이어받는다
    logger.info("extract: extraction=%s [field] verify %s", extraction.id,
                verify_vouchers(done, pdf_bytes))
    return {"stage": "repair", "data": data}


async def advance_repair(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    """분쟁 셀(미확인·출처불량·형식불량)만 sonnet-5 재추출 → 재채점 통과 시에만 교체 (lab E21)."""
    data = progress.get("data") or {}
    vouchers = data.get("vouchers") or []
    if not vouchers:
        return {"stage": "dm", "data": data}
    pages = await _load_pages(storage, data)
    units = build_repair_units(pages=pages, vouchers=vouchers, field_defs=FIELD_PACK["fields"])
    if units:
        pdf_bytes, _ = await _resolve_pdf(gdoc_facade, storage, extraction)
        results = await run_stage(
            units, ai_facade=ai_facade,
            ai_context=_ctx(extraction, AIPurpose.VOUCHER_MD_TO_JSON), flex=False,
        )
        logs = apply_repair_results(vouchers, results, page_texts(pdf_bytes))
        data["repair_report"] = logs
        logger.info("extract: extraction=%s [repair] %d건 → %s", extraction.id, len(units), logs)
    data["vouchers"] = vouchers
    return {"stage": "dm", "data": data}


async def advance_dm(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    data = progress.get("data") or {}
    pages = await _load_pages(storage, data)
    full_doc = full_markdown(pages)

    async def _build():
        # K=2 교집합 게이트 (lab E22): 같은 유닛 2개 병렬 제출 → 값 일치 키만 채택 (오상속 봉쇄)
        u1 = build_dm_unit(model=MODEL_PRIMARY, full_doc=full_doc)
        u2 = build_dm_unit(model=MODEL_PRIMARY, full_doc=full_doc)
        return [u1, BatchUnit(**{**u2.__dict__, "key": "meta2"})]

    try:
        results = await run_stage(
            await _build(), ai_facade=ai_facade,
            ai_context=_ctx(extraction, AIPurpose.VOUCHER_MD_TO_JSON),
        )
        for key in ("meta", "meta2"):
            r = results.get(key)
            if r is not None and not r.ok:
                logger.warning(
                    "extract: extraction=%s [DM] %s 호출 실패 — %s", extraction.id, key, r.error
                )
        meta = intersect_meta(parse_dm_result(results["meta"]), parse_dm_result(results["meta2"]))
        if not any(v for v in meta.values()):
            logger.warning("extract: extraction=%s [DM] 문서 메타 전부 비었음", extraction.id)
    except Exception:  # noqa: BLE001
        logger.exception("extract: extraction=%s [DM] 문서 메타 추출 실패 — 빈 메타", extraction.id)
        meta = {}

    data["meta"] = meta
    return {"stage": "finalize", "data": data}


async def advance_s3_detect(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    # 청크 전진 — 213쪽을 한 호출에 몰면 요청 수명을 넘긴다(field 와 같은 사유).
    data = progress.get("data") or {}
    scanned = int(data.get("s3_scanned") or 0)
    found = data.get("form_pages") or []

    pdf_bytes, _ = await _resolve_pdf(gdoc_facade, storage, extraction)
    units = FormPageDetectService.build_units(document_bytes=pdf_bytes, model=MODEL_FALLBACK)
    chunk = units[scanned : scanned + S3_CHUNK]
    if not chunk:
        data["form_pages"] = found
        return {"stage": "review", "data": data}

    results = await run_stage(
        chunk, ai_facade=ai_facade,
        ai_context=_ctx(extraction, AIPurpose.FORM_EXTRACT_SCHEMA),
    )
    result = FormPageDetectService.assemble(results, model=MODEL_FALLBACK)
    found.extend(
        {
            "page": fp.page, "title": fp.title, "kind": fp.kind,
            "scope": fp.scope, "voucher_name": fp.voucher_name, "reason": fp.reason,
        }
        for fp in result.form_pages
    )
    data["form_pages"] = found
    data["s3_scanned"] = scanned + len(chunk)
    logger.info("extract: extraction=%s [s3_detect] %d/%d 쪽 · 서식 %d",
                extraction.id, data["s3_scanned"], len(units), len(found))
    if data["s3_scanned"] < len(units):
        return {"stage": "s3_detect", "data": data}
    # 1단계 끝 — 감지된 영역(spans)·서식 쪽(form_pages)을 들고 사용자 확정을 기다린다.
    # FormSchema 추출(partition/ground)은 voucher가 하지 않는다 — 서식 페이지 감지까지만.
    return {"stage": "review", "data": data}


async def advance_finalize(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction,
    progress: dict,
) -> dict:
    data = progress.get("data") or {}
    vouchers = data.get("vouchers") or []
    meta = data.get("meta") or {}

    pdf_bytes, base_name = await _resolve_pdf(gdoc_facade, storage, extraction)
    try:
        stats = snap_voucher_quotes(vouchers, pdf_bytes)
        if meta:
            snap_meta_quotes(meta, pdf_bytes)
        logger.info(
            "extract: extraction=%s [S2c] 스내핑 %d quote (exact %d / snapped %d / none %d)",
            extraction.id, stats.total, stats.exact, stats.snapped, stats.none,
        )
    except Exception:  # noqa: BLE001
        logger.exception("extract: extraction=%s [S2c] 스내핑 실패 — quote 원본만 저장", extraction.id)
    try:
        tally = verify_vouchers(vouchers, pdf_bytes)   # 결정론 귀속 검증 (lab E17) — 계기판
        logger.info("extract: extraction=%s [verify] %s", extraction.id, tally)
        for v in vouchers:                              # record = 화면·confirm 정본 (E24 — f15700c75 회귀 복구)
            if isinstance(v.get("fields"), dict):
                v["record"], v["findings"] = map_capture(v["fields"])
                v["findings"].extend(flag_fields(v["fields"]))  # 검토 플래그 5종 (E39: 정밀 8/8·오탐 0)
                # 금액 행에 출처가 전혀 없으면 바우처 첫 페이지로 폴백 (뷰어 이동만, 하이라이트 없음 — 정직)
                if v.get("span"):
                    for grp in v["record"].get("금액") or []:
                        for row in grp.get("금액") or []:
                            row.setdefault("ref", None)
                            row["ref"] = row["ref"] or {"page": f"p-{span_ints(v['span'])[0]:03d}"}
    except Exception:  # noqa: BLE001
        logger.exception("extract: extraction=%s [verify] 검증 실패 — 등급 없이 저장", extraction.id)

    # 서식 정본 = 사용자가 확정한 구간(form_units: {title, kind, start_page, end_page}) —
    # 여러 장짜리 서식이 한 단위다. 확정을 안 거친 구 데이터는 감지 쪽(form_pages)을
    # 한 쪽 = 한 단위로 강등해 저장한다.
    form_units = data.get("form_units")
    if form_units is None:
        form_units = [
            {
                "title": fp["title"], "kind": fp["kind"],
                "scope": fp.get("scope") or "unknown",
                "voucher_names": [fp["voucher_name"]] if fp.get("voucher_name") else [],
                "start_page": page_num(fp["page"]), "end_page": page_num(fp["page"]),
            }
            for fp in (data.get("form_pages") or [])
        ]
    saved_forms: list[dict] = []
    if form_units:
        # 단위의 쪽들을 펴서 PNG 저장 — 쪽 제목은 단위 제목 상속
        flat_pages = [
            FormPage(page=f"p-{n:03d}", title=u.get("title") or "", kind=u.get("kind") or "기타", reason="")
            for u in form_units
            for n in range(int(u["start_page"]), int(u["end_page"]) + 1)
        ]
        saved = await SaveFormPagesService(
            gdoc_facade=gdoc_facade, voucher_facade=voucher_facade
        ).execute(extraction=extraction, pdf_bytes=pdf_bytes, form_pages=flat_pages, base_name=base_name)
        doc_by_page = {page_num(s.page): s.global_document_id for s in saved}
        saved_forms = [
            {
                "title": u.get("title") or "",
                "kind": u.get("kind") or "기타",
                "scope": u.get("scope") or "unknown",
                "voucher_names": u.get("voucher_names") or [],
                "page_range": [int(u["start_page"]), int(u["end_page"])],
                "pages": [
                    {"page": f"p-{n:03d}", "global_document_id": doc_by_page.get(n)}
                    for n in range(int(u["start_page"]), int(u["end_page"]) + 1)
                ],
            }
            for u in form_units
        ]

    await voucher_facade.mark_extraction_completed(
        extraction_id=extraction.id,
        meta=meta,
        vouchers=vouchers,
        forms=saved_forms,
    )
    return {"stage": "done", "data": {}}


STAGE_FUNCS = {
    "route": advance_route,
    "list": advance_list,
    "tx": advance_tx,
    "s1": advance_s1,
    "s2a": advance_s2a,
    "field": advance_field,
    "repair": advance_repair,
    "dm": advance_dm,
    "s3_detect": advance_s3_detect,
    "finalize": advance_finalize,
}
