"""독립 form 추출 서비스 — document(PDF) → {page: FormSchema}.

voucher 파이프라인과 분리된 온디맨드 진입점. detect → partition → ground(CV/OCR 정밀 배치)
전 단계를 한 호출로 수행한다. flex 미적용(표준 등급) — 지연·신뢰성 우선(사용자 결정).

빌드/조립 프리미티브(FormPageDetectService·partition_batch·ground_batch)를 재사용하고,
실행은 run_stage_realtime(flex=False)로 실시간 병렬. 다중 서식 페이지 지원.
"""
from __future__ import annotations

from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.llm.gateway.schemas import AICallContext
from app.runtime.voucher_document.batch_unit import run_stage_realtime
from app.runtime.voucher_document.processing_spec import MODEL_FALLBACK, MODEL_PRIMARY

from .ground_batch import apply_ground_results, build_ground_units
from .page_detect import FormPageDetectService
from .partition_batch import apply_partition_results, build_partition_units


class DocumentToFormService:
    def __init__(
        self,
        ai_facade: AIFacade,
    ):
        self._ai = ai_facade

    async def execute(
        self,
        *,
        document_bytes: bytes,
        ai_context: AICallContext,
    ) -> dict[str, dict]:
        """document → {page: FormSchema}. 서식 없으면 {}."""
        async def _run(units):
            return await run_stage_realtime(
                units, ai_facade=self._ai, ai_context=ai_context, flex=False
            )

        # detect
        detect = FormPageDetectService.assemble(
            await _run(
                FormPageDetectService.build_units(document_bytes=document_bytes, model=MODEL_FALLBACK)
            ),
            model=MODEL_FALLBACK,
        )
        form_pages = [fp.page for fp in detect.form_pages]
        if not form_pages:
            return {}

        # partition
        punits, no_atoms_pages = build_partition_units(
            pdf_bytes=document_bytes, form_pages=form_pages, model=MODEL_PRIMARY
        )
        partitions = apply_partition_results(await _run(punits), pdf_bytes=document_bytes)

        # ground
        gunits = build_ground_units(
            pdf_bytes=document_bytes,
            form_pages=[p for p in form_pages if p not in no_atoms_pages],
            partitions=partitions, model=MODEL_PRIMARY,
        )
        return apply_ground_results(
            await _run(gunits), pdf_bytes=document_bytes,
            form_pages=form_pages, no_atoms_pages=no_atoms_pages,
        )
