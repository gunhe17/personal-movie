"""조회-트리거 전진 — 조회 1회 = 정확히 한 단계만 전진(다단계 연쇄 금지).

`get_voucher_extraction_handler`(관리자 화면이 이미 폴링 중)가 호출될 때마다 이 함수를
거쳐 `progress.stage`에 해당하는 `runner.STAGE_FUNCS`의 스테이지 함수 하나만 부른다.
정상 흐름은 이 조회-트리거가 전담하고, 아무도 조회하지 않는 드문 경우(탭을 닫아둠 등)만
안전망 cron(`voucher_batch_sweep`)이 같은 함수로 대신 훑는다.
"""
from __future__ import annotations

from app.core.exceptions import InvalidOperationException
from app.infrastructure.storage.common.base import StorageClient
from app.modules.document.facade import GlobalDocumentFacade
from app.modules.llm.facade.ai_facade import AIFacade
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.modules.voucher.voucher_extraction.models import VoucherExtraction  # 타입힌트 전용(facade Entity-return)

from .runner import STAGE_FUNCS


async def advance_batch_stage_if_ready(
    *,
    ai_facade: AIFacade,
    voucher_facade: VoucherFacade,
    gdoc_facade: GlobalDocumentFacade,
    storage: StorageClient,
    extraction: VoucherExtraction,
) -> None:
    """`progress.stage`가 가리키는 스테이지 함수를 1회 호출하고 결과를 저장한다.

    stage가 없거나 이미 "done"이면 no-op. status=processing 게이트는 호출자
    (핸들러·cron 모두 이미 필터링) 책임이라 여기선 재확인하지 않는다.
    """
    progress = extraction.progress or {}
    stage = progress.get("stage")
    if not stage or stage == "done":
        return

    advance = STAGE_FUNCS.get(stage)
    if advance is None:
        return

    try:
        new_progress = await advance(
            ai_facade=ai_facade,
            voucher_facade=voucher_facade,
            gdoc_facade=gdoc_facade,
            storage=storage,
            extraction=extraction,
            progress=progress,
        )
    except InvalidOperationException as e:
        await voucher_facade.mark_extraction_failed(extraction.id, reason=str(e))
        return

    if new_progress.get("stage") == "done":
        return  # advance_finalize가 이미 mark_extraction_completed 호출함
    # 새 progress 는 claimed_at 없는 dict — 다음 단계로 넘어가며 실행권(voucher_stage_claim)도 함께 풀린다
    await voucher_facade.update_extraction_progress(extraction.id, new_progress)
